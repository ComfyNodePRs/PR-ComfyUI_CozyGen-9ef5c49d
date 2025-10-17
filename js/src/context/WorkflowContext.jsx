import { createContext, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { getWorkflows, getWorkflow, getChoices, getQueue } from '../api';

const WorkflowContext = createContext();

export const useWorkflow = () => useContext(WorkflowContext);

const choiceTypeMapping = {
    "clip_name1": "clip",
    "clip_name2": "clip",
    "unet_name": "unet",
    "vae_name": "vae",
    "sampler_name": "sampler",
    "scheduler": "scheduler",
};

export const WorkflowProvider = ({ children }) => {
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(
        localStorage.getItem('selectedWorkflow') || null
    );
    const [workflowData, setWorkflowData] = useState(null);
    const [dynamicInputs, setDynamicInputs] = useState([]);
    const [formData, setFormData] = useState({});
    const [randomizeState, setRandomizeState] = useState({});
    const [bypassedState, setBypassedState] = useState({});

    // Queue State
    const [queue, setQueue] = useState([]);
    const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState(JSON.parse(localStorage.getItem('lastPreviewImages')) || []);
    const [previewVideo, setPreviewVideo] = useState(null);
    const [progressValue, setProgressValue] = useState(0);
    const [progressMax, setProgressMax] = useState(0);
    const [statusText, setStatusText] = useState('Idle');

    // Load draw state from localStorage
    const initialDrawState = JSON.parse(localStorage.getItem('cozygen_draw_state')) || {};
    const [layers, setLayers] = useState(initialDrawState.layers || []);
    const [stageSize, setStageSize] = useState(initialDrawState.stageSize || { width: 512, height: 512 });
    const [tool, setTool] = useState(initialDrawState.tool || 'pen');
    const [activeLayerId, setActiveLayerId] = useState(initialDrawState.activeLayerId || 1);
    const [brushColor, setBrushColor] = useState(initialDrawState.brushColor || '#000000');
    const [brushSize, setBrushSize] = useState(initialDrawState.brushSize || 5);
    const [brushOpacity, setBrushOpacity] = useState(initialDrawState.brushOpacity || 1);
    const [eraserSize, setEraserSize] = useState(initialDrawState.eraserSize || 20);
    const [stage, setStage] = useState(initialDrawState.stage || { scale: 1, x: 0, y: 0 });

    // Save draw state to localStorage
    useEffect(() => {
        const drawState = { layers, stageSize, tool, activeLayerId, brushColor, brushSize, brushOpacity, eraserSize, stage };
        localStorage.setItem('cozygen_draw_state', JSON.stringify(drawState));
    }, [layers, stageSize, tool, activeLayerId, brushColor, brushSize, brushOpacity, eraserSize, stage]);



    const fetchQueue = async () => {
        try {
            const serverQueueData = await getQueue();
            setQueue(serverQueueData.queue || []);
        } catch (error) {
            console.error("Failed to fetch queue:", error);
        }
    };

    // Fetch and poll the server-side queue
    useEffect(() => {
        fetchQueue(); // Initial fetch
        const intervalId = setInterval(fetchQueue, 2000); // Poll every 2 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []); // Empty dependency array is crucial here

    // WebSocket for real-time updates
    useEffect(() => {
        const connectWebSocket = () => {
            const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
            const host = window.location.host;
            const wsUrl = `${protocol}://${host}/ws`;
            return new WebSocket(wsUrl);
        };

        const websocket = connectWebSocket();

        websocket.onmessage = (event) => {
            if (typeof event.data !== 'string') return;
            const msg = JSON.parse(event.data);

            const promptId = msg.data?.prompt_id;

            if (msg.type === 'execution_start' && promptId) {
                setQueue(currentQueue => currentQueue.map(job => 
                    job.comfy_prompt_id === promptId ? { ...job, status: 'running' } : job
                ));
            } else if (msg.type === 'progress' && promptId) {
                setQueue(currentQueue => {
                    const isJobRunning = currentQueue.some(job => job.comfy_prompt_id === promptId && job.status === 'running');
                    if (isJobRunning) {
                        setProgressValue(msg.data.value);
                        setProgressMax(msg.data.max);
                    }
                    return currentQueue; // No change to the queue itself
                });
            } else if (msg.type === 'cozygen_batch_ready' || msg.type === 'cozygen_video_ready') {
                const { job_id } = msg.data;
                if (job_id) {
                    let thumbnailUrl = '';
                    if (msg.type === 'cozygen_batch_ready') {
                        const imageUrls = msg.data.images.map(image => image.url);
                        if (imageUrls.length > 0) {
                            setPreviewImages(imageUrls);
                            localStorage.setItem('lastPreviewImages', JSON.stringify(imageUrls));
                            thumbnailUrl = imageUrls[0];
                        }
                    } else { // video
                        const videoUrl = msg.data.url;
                        if (videoUrl) {
                            setPreviewVideo(videoUrl);
                            setPreviewImages([]);
                            localStorage.removeItem('lastPreviewImages');
                            thumbnailUrl = videoUrl;
                        }
                    }

                    setQueue(currentQueue => currentQueue.map(job =>
                        job.id === job_id ? { ...job, status: 'completed', thumbnailUrl } : job
                    ));

                    setStatusText('Finished');
                    setProgressValue(0);
                    setProgressMax(0);
                }
            } else if (['execution_error', 'execution_interrupted'].includes(msg.type) && promptId) {
                setQueue(currentQueue => currentQueue.map(job => 
                    job.comfy_prompt_id === promptId ? { ...job, status: 'error' } : job
                ));
                setStatusText('Error');
                setProgressValue(0);
                setProgressMax(0);
            }
        };

        websocket.onclose = () => {
            // Optional: handle reconnection logic here if needed
        };

        websocket.onerror = (err) => {
            console.error('CozyGen: WebSocket error: ', err);
        };

        return () => {
            websocket.close();
        };
    }, []); // Run only once

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const data = await getWorkflows();
                setWorkflows(data.workflows || []);
            } catch (error) {
                console.error(error);
            }
        };
        fetchWorkflows();
    }, []);

    useEffect(() => {
        if (!selectedWorkflow) return;

        const fetchWorkflowData = async () => {
            try {
                const data = await getWorkflow(selectedWorkflow);
                setWorkflowData(data);

                const COZYGEN_INPUT_TYPES = [
                    'CozyGenDynamicInput',
                    'CozyGenImageInput',
                    'CozyGenFloatInput',
                    'CozyGenIntInput',
                    'CozyGenStringInput',
                    'CozyGenChoiceInput'
                ];

                const allInputNodes = Object.values(data).filter(node => COZYGEN_INPUT_TYPES.includes(node.class_type));

                for (const nodeId in data) {
                    if (COZYGEN_INPUT_TYPES.includes(data[nodeId].class_type)) {
                        data[nodeId].id = nodeId;
                    }
                }

                allInputNodes.sort((a, b) => (a.inputs['priority'] || 0) - (b.inputs['priority'] || 0));

                const inputsWithChoices = await Promise.all(allInputNodes.map(async (input) => {
                    const isDynamicDropdown = input.class_type === 'CozyGenDynamicInput' && input.inputs['param_type'] === 'DROPDOWN';
                    const isChoiceNode = input.class_type === 'CozyGenChoiceInput';

                    if (isDynamicDropdown || isChoiceNode) {
                        const param_name = input.inputs['param_name'];
                        let choiceType = input.inputs['choice_type'] || (input.properties && input.properties['choice_type']);

                        if (!choiceType && isDynamicDropdown) {
                            choiceType = choiceTypeMapping[param_name];
                        }

                        if (choiceType) {
                            try {
                                const choicesData = await getChoices(choiceType);
                                input.inputs.choices = choicesData.choices || [];
                            } catch (error) {
                                console.error(`Error fetching choices for ${param_name} (choiceType: ${choiceType}):`, error);
                                input.inputs.choices = [];
                            }
                        }
                    }
                    return input;
                }));

                setDynamicInputs(inputsWithChoices);

                const savedFormData = JSON.parse(localStorage.getItem(`${selectedWorkflow}_formData`)) || {};
                const initialFormData = {};
                inputsWithChoices.forEach(input => {
                    const param_name = input.inputs['param_name'];
                    if (savedFormData[param_name] === undefined) {
                        let defaultValue;
                        if (['CozyGenDynamicInput', 'CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput'].includes(input.class_type)) {
                            defaultValue = input.inputs['default_value'];
                            if (input.class_type === 'CozyGenIntInput') {
                                defaultValue = parseInt(defaultValue, 10);
                            } else if (input.class_type === 'CozyGenFloatInput') {
                                defaultValue = parseFloat(defaultValue);
                            }
                        } else if (input.class_type === 'CozyGenChoiceInput') {
                            defaultValue = input.inputs.choices && input.inputs.choices.length > 0 ? input.inputs.choices[0] : '';
                        } else if (input.class_type === 'CozyGenImageInput') {
                            defaultValue = '';
                        }
                        initialFormData[param_name] = defaultValue;
                    } else {
                        initialFormData[param_name] = savedFormData[param_name];
                    }
                });
                setFormData(initialFormData);

                const savedRandomizeState = JSON.parse(localStorage.getItem(`${selectedWorkflow}_randomizeState`)) || {};
                setRandomizeState(savedRandomizeState);

                const savedBypassedState = JSON.parse(localStorage.getItem(`${selectedWorkflow}_bypassedState`)) || {};
                setBypassedState(savedBypassedState);

            } catch (error) {
                console.error(error);
            }
        };

        fetchWorkflowData();
    }, [selectedWorkflow]);

    const handleWorkflowSelect = (workflow) => {
        setSelectedWorkflow(workflow);
        localStorage.setItem('selectedWorkflow', workflow);
        setWorkflowData(null);
        setDynamicInputs([]);
        setFormData({});
        setRandomizeState({});
    };

    const handleFormChange = (inputName, value) => {
        const newFormData = { ...formData, [inputName]: value };
        setFormData(newFormData);
        localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(newFormData));
    };

    const toggleQueuePanel = () => {
        setIsQueuePanelOpen(prevState => !prevState);
    };

    const value = {
        workflows,
        selectedWorkflow,
        workflowData,
        dynamicInputs,
        formData,
        randomizeState,
        bypassedState,
        layers,
        stageSize,
        tool,
        activeLayerId,
        brushColor,
        brushSize,
        brushOpacity,
        eraserSize,
        stage,
        queue,
        isQueuePanelOpen,
        previewImages,
        previewVideo,
        progressValue,
        progressMax,
        statusText,
        handleWorkflowSelect,
        handleFormChange,
        setFormData, // Expose setFormData for direct manipulation
        setWorkflowData, // Expose setWorkflowData for direct manipulation
        setRandomizeState,
        setBypassedState,
        setLayers,
        setStageSize,
        setTool,
        setActiveLayerId,
        setBrushColor,
        setBrushSize,
        setBrushOpacity,
        setEraserSize,
        setStage,
        fetchQueue, // Expose fetchQueue
        toggleQueuePanel,
        setPreviewImages,
        setPreviewVideo,
        setProgressValue,
        setProgressMax,
        setStatusText,
    };

    return (
        <WorkflowContext.Provider value={value}>
            {children}
        </WorkflowContext.Provider>
    );
};

WorkflowProvider.propTypes = {
    children: PropTypes.node.isRequired,
};