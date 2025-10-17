import React, { useState, useEffect, useRef } from 'react';
import { useWorkflow } from '../context/WorkflowContext'; // Import the hook
import { useNavigate } from 'react-router-dom';
import LayerSelectionModal from '../components/LayerSelectionModal';
import SelectionModal from '../components/SelectionModal';
import WorkflowSelector from '../components/WorkflowSelector';
import DynamicForm from '../components/DynamicForm';
import ImageInput from '../components/ImageInput';
import QueuePanel from '../components/QueuePanel'; // Import the new QueuePanel
import { submitJob, uploadImage, getPresets, getPreset, savePreset, deletePreset } from '../api';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { QueueListIcon, DocumentArrowDownIcon, FolderIcon, TrashIcon } from '@heroicons/react/24/outline'; // Import a suitable icon
import { useViewportFix } from '../hooks/useViewportFix';

// Modal styles and render functions (remain unchanged)
const isVideo = (url) => /\.(mp4|webm)/i.test(url);

const customStyles = {
  content: {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
    marginRight: '0',
    backgroundColor: '#2D3748',
    border: 'none',
    borderRadius: '8px',
    padding: '0rem',
    maxHeight: '90vh',
    width: '90vw',
    maxWidth: '864px',
    overflow: 'auto',
    flexShrink: 0,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }
};

Modal.setAppElement('#root');

const renderPreviewContent = (url) => {
    if (!url) return null;
    if (isVideo(url)) {
        return <video src={url} controls autoPlay loop muted className="max-w-full max-h-full object-contain rounded-lg" />;
    } else {
        return <img src={url} alt="Generated preview" className="max-w-full max-h-full object-contain rounded-lg cursor-pointer" />;
    }
};

const renderModalContent = (url) => {
    if (!url) return null;
    if (isVideo(url)) {
        return <video src={url} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-lg" />;
    } else {
        return (
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                limitToBounds={false}
                doubleClick={{ disabled: true }}
                wheel={true}
            >
                <TransformComponent>
                    <img src={url} alt="Generated preview" className="max-w-full max-h-full object-contain rounded-lg" />
                </TransformComponent>
            </TransformWrapper>
        );
    }
};

function MainPage() {
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
    const [isLoadPresetModalOpen, setIsLoadPresetModalOpen] = useState(false);
    const [presets, setPresets] = useState([]);
    const [newPresetName, setNewPresetName] = useState('');
    // Use the context to get state and handlers
    const {
        workflows,
        selectedWorkflow,
        workflowData,
        dynamicInputs,
        formData,
        randomizeState,
        bypassedState,
        handleWorkflowSelect,
        handleFormChange,
        setFormData,
        setRandomizeState,
        setBypassedState,
        layers,
        setLayers,
        stageSize,
        fetchQueue,
        toggleQueuePanel, // Get from context
        previewImages, 
        setPreviewImages, 
        previewVideo, 
        setPreviewVideo,
        queue,
        progressValue,
        progressMax,
        statusText,
    } = useWorkflow();
    const navigate = useNavigate();

    const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);
    const isLoading = queue.some(job => job.status === 'running');
    const websocketRef = useRef(null);
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
    const [layerInputOptions, setLayerInputOptions] = useState([]);
    const [isImageInputModalOpen, setIsImageInputModalOpen] = useState(false);
    const [imageInputOptions, setImageInputOptions] = useState([]);
    const [isQueuing, setIsQueuing] = useState(false);
    const [batchCount, setBatchCount] = useState(1);

    const bottomBarRef = useViewportFix();
    const workflowDataRef = useRef(null);


    const handleOpenSavePresetModal = () => {
        setNewPresetName('');
        setIsSavePresetModalOpen(true);
    };

    const handleOpenLoadPresetModal = async () => {
        if (!selectedWorkflow) return;
        try {
            const data = await getPresets(selectedWorkflow);
            setPresets(data.presets || []);
            setIsLoadPresetModalOpen(true);
        } catch (error) {
            console.error("Failed to load presets:", error);
            alert('Failed to load presets.');
        }
    };

    const handleSavePreset = async () => {
        if (!newPresetName || !selectedWorkflow) return;
        try {
            await savePreset(selectedWorkflow, newPresetName, formData);
            setIsSavePresetModalOpen(false);
            alert(`Preset '${newPresetName}' saved successfully!`);
        } catch (error) {
            console.error("Failed to save preset:", error);
            alert('Failed to save preset.');
        }
    };

    const handleLoadPreset = async (presetName) => {
        if (!selectedWorkflow) return;
        try {
            const presetData = await getPreset(selectedWorkflow, presetName);
            const newFormData = { ...formData, ...presetData };
            setFormData(newFormData);
            localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(newFormData));
            setIsLoadPresetModalOpen(false);
            alert(`Preset '${presetName.replace('.json', '')}' loaded.`);
        } catch (error) {
            console.error("Failed to load preset:", error);
            alert('Failed to load preset.');
        }
    };

    const handleDeletePreset = async (presetName) => {
        if (!selectedWorkflow || !window.confirm(`Are you sure you want to delete the preset '${presetName.replace('.json', '')}'?`)) return;
        try {
            await deletePreset(selectedWorkflow, presetName);
            setPresets(presets.filter(p => p !== presetName));
        } catch (error) {
            console.error("Failed to delete preset:", error);
            alert('Failed to delete preset.');
        }
    };

    const openModalWithImage = (imageSrc) => {
        setSelectedPreviewImage(imageSrc);
        setModalIsOpen(true);
    };

    useEffect(() => {
        workflowDataRef.current = workflowData;
    }, [workflowData]);


    const handleRandomizeToggle = (inputName, isRandom) => {
        const newRandomizeState = { ...randomizeState, [inputName]: isRandom };
        setRandomizeState(newRandomizeState);
        localStorage.setItem(`${selectedWorkflow}_randomizeState`, JSON.stringify(newRandomizeState));
    };

    const handleBypassToggle = (inputName, isBypassed) => {
        const newBypassedState = { ...bypassedState, [inputName]: isBypassed };
        setBypassedState(newBypassedState);
        localStorage.setItem(`${selectedWorkflow}_bypassedState`, JSON.stringify(newBypassedState));
    };

    const handleBatchCountChange = (e) => {
        const val = e.target.value;
        if (val === '' || val === '0') {
            setBatchCount('');
        } else {
            const num = parseInt(val, 10);
            if (num > 0) {
                setBatchCount(num);
            }
        }
    };

    const handleAddToQueue = async () => {
        if (!workflowData || isQueuing) return;

        const numToQueue = parseInt(batchCount, 10) || 1;

        setIsQueuing(true);

        try {
            for (let i = 0; i < numToQueue; i++) {
                // The rest of the logic from the original handleGenerate to prepare the workflow
                let finalWorkflow = JSON.parse(JSON.stringify(workflowData));

                // ... (all the bypass and value injection logic remains the same)
                const COZYGEN_REROUTE_TYPES = ['CozyGenDynamicInput', 'CozyGenChoiceInput'];
                const rerouteBypassedNodes = dynamicInputs.filter(dn => 
                    bypassedState[dn.inputs.param_name] && COZYGEN_REROUTE_TYPES.includes(dn.class_type)
                );
                
                for (const bypassedNode of rerouteBypassedNodes) {
                    let targetNodeId = Object.keys(finalWorkflow).find(id => 
                        Object.values(finalWorkflow[id].inputs).some(input => Array.isArray(input) && input[0] === bypassedNode.id)
                    );

                    if (!targetNodeId) continue;

                    const targetNode = finalWorkflow[targetNodeId];
                    const upstreamSources = {};
                    for (const inputName in targetNode.inputs) {
                        const input = targetNode.inputs[inputName];
                        if (Array.isArray(input) && finalWorkflow[input[0]] && !COZYGEN_REROUTE_TYPES.includes(finalWorkflow[input[0]].class_type)) {
                            upstreamSources[inputName] = input;
                        }
                    }

                    if (Object.keys(upstreamSources).length === 0) continue;

                    const downstreamConnections = [];
                    for (const nodeId in finalWorkflow) {
                        for (const inputName in finalWorkflow[nodeId].inputs) {
                            const input = finalWorkflow[nodeId].inputs[inputName];
                            if (Array.isArray(input) && input[0] === targetNodeId) {
                                downstreamConnections.push({ nodeId, inputName });
                            }
                        }
                    }

                    for (const conn of downstreamConnections) {
                        const upstreamSource = upstreamSources[conn.inputName];
                        if (upstreamSource) {
                            finalWorkflow[conn.nodeId].inputs[conn.inputName] = upstreamSource;
                        }
                    }

                    delete finalWorkflow[targetNodeId];
                    delete finalWorkflow[bypassedNode.id];
                }

                const imageInputBypassedNodes = dynamicInputs.filter(dn => 
                    dn.class_type === 'CozyGenImageInput' && bypassedState[dn.inputs.param_name]
                );

                for (const bypassedNode of imageInputBypassedNodes) {
                    if (finalWorkflow[bypassedNode.id]) {
                        finalWorkflow[bypassedNode.id].mode = 2; // Set mode to Mute/Bypass
                    }
                }

                let updatedFormData = { ...formData };
                dynamicInputs.forEach(dynamicNode => {
                    if (!finalWorkflow[dynamicNode.id]) return;
                    const param_name = dynamicNode.inputs.param_name;
                    if (dynamicNode.class_type === 'CozyGenImageInput') return;
                    let valueToInject = randomizeState[param_name] 
                        ? (dynamicNode.inputs.param_type === 'FLOAT' ? Math.random() * ((dynamicNode.inputs.max_value || 1000000) - (dynamicNode.inputs.min_value || 0)) + (dynamicNode.inputs.min_value || 0) : Math.floor(Math.random() * ((dynamicNode.inputs.max_value || 1000000) - (dynamicNode.inputs.min_value || 0) + 1)) + (dynamicNode.inputs.min_value || 0))
                        : formData[param_name];
                    
                    // Only update form data for the first item in a batch to avoid visual confusion
                    if (i === 0) {
                        updatedFormData[param_name] = valueToInject;
                    }

                    const nodeToUpdate = finalWorkflow[dynamicNode.id];
                    if (nodeToUpdate) {
                        if (['CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput', 'CozyGenDynamicInput'].includes(dynamicNode.class_type)) {
                            nodeToUpdate.inputs.default_value = valueToInject;
                        } else if (dynamicNode.class_type === 'CozyGenChoiceInput') {
                            nodeToUpdate.inputs.value = valueToInject;
                        }
                    }
                });
                
                if (i === 0) {
                    setFormData(updatedFormData);
                    localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(updatedFormData));
                }

                const imageInputNodes = dynamicInputs.filter(dn => dn.class_type === 'CozyGenImageInput');
                for (const node of imageInputNodes) {
                    if (!bypassedState[node.inputs.param_name]) {
                        const image_filename = formData[node.inputs.param_name];
                        if (!image_filename) {
                            alert(`Please upload an image for "${node.inputs.param_name}" or bypass it before generating.`);
                            setIsQueuing(false);
                            return;
                        }
                        if (finalWorkflow[node.id]) {
                            finalWorkflow[node.id].inputs.image_filename = image_filename;
                        }
                    }
                }

                await submitJob({
                    prompt: finalWorkflow,
                    workflowName: selectedWorkflow.replace(/\.json$/, ''),
                });
            }

            fetchQueue(); // Refresh the queue view once at the end
            console.log(`Submitted ${numToQueue} job(s) to server-side queue`);

        } catch (error) {
            console.error("Failed to submit job:", error);
            alert(`Failed to submit job: ${error.message}`);
        } finally {
            setTimeout(() => setIsQueuing(false), 500);
        }
    };


    const handleClearPreview = () => {
        setPreviewImages([]);
        setPreviewVideo(null);
        localStorage.removeItem('lastPreviewImages');
    };

    const handleSendToLayer = async () => {
        if (layers.length === 0) {
            alert('No layers found in the draw page.');
            return;
        }
        setLayerInputOptions(layers);
        setIsLayerModalOpen(true);
    };

    const handleLayerTargetSelection = async (selectedLayerId) => {
        setIsLayerModalOpen(false);
        if (!selectedLayerId || !selectedPreviewImage) return;

        try {
            const imageBlob = await fetch(selectedPreviewImage).then(r => r.blob());
            const reader = new FileReader();
            reader.onload = (event) => {
                const image = new Image();
                image.onload = () => {
                    const scale = Math.min(stageSize.width / image.width, stageSize.height / image.height);
                    const newLayers = layers.map(layer => {
                        if (layer.id === selectedLayerId) {
                            return { ...layer, lines: [...layer.lines, { tool: 'image', image: image, x: 0, y: 0, scaleX: scale, scaleY: scale }] };
                        }
                        return layer;
                    });
                    setLayers(newLayers);
                    navigate('/draw');
                };
                image.src = event.target.result;
            };
            reader.readAsDataURL(imageBlob);
        } catch (error) {
            console.error("Error sending image to layer:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleSendToInput = async () => {
        if (!workflowData) {
            alert('No workflow loaded. Please select a workflow on the main page first.');
            return;
        }

        const imageInputs = dynamicInputs.filter(input => input.class_type === 'CozyGenImageInput');

        if (imageInputs.length === 0) {
            alert('No compatible image input node was found in the current workflow.');
            return;
        }

        if (imageInputs.length === 1) {
            handleImageTargetSelection(imageInputs[0].inputs.param_name);
        } else {
            setImageInputOptions(imageInputs.map(input => input.inputs.param_name));
            setIsImageInputModalOpen(true);
        }
    };

    const handleImageTargetSelection = async (selectedParamName) => {
        setIsImageInputModalOpen(false);
        if (!selectedParamName || !selectedPreviewImage) return;

        try {
            const imageBlob = await fetch(selectedPreviewImage).then(r => r.blob());
            const uploadResponse = await uploadImage(new File([imageBlob], "sent_image.png"));
            const filename = uploadResponse.filename;

            if (!filename) {
                throw new Error('Upload server did not return a filename.');
            }

            handleFormChange(selectedParamName, filename);
            setModalIsOpen(false);

        } catch (error) {
            console.error("Error sending image to input:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const inProgressCount = queue.filter(job => job.status === 'pending' || job.status === 'running').length;

    if (selectedWorkflow && (!workflowData || !dynamicInputs)) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-white text-2xl">Loading Workflow...</div>
            </div>
        );
    }


    return (
        <div className="max-w-7xl mx-auto">
            <QueuePanel />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-28">
                {/* Right Column: Preview & Generate Button */}
                <div className="flex flex-col space-y-2">
                    <div className="bg-base-200 shadow-lg rounded-lg p-3 min-h-[400px] lg:min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">Preview</h2>
                            <button 
                                onClick={handleClearPreview}
                                className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="relative flex-grow flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg p-2 overflow-y-auto">
                            {/* Content */}
                            {!previewVideo && previewImages.length === 0 && (
                                <p className="text-gray-400">Your generated image or video will appear here.</p>
                            )}
                            {previewVideo && (
                                <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => openModalWithImage(previewVideo)}>
                                    {renderPreviewContent(previewVideo)}
                                </div>
                            )}
                            {!previewVideo && previewImages.length === 1 && (
                                <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => openModalWithImage(previewImages[0])}>
                                    {renderPreviewContent(previewImages[0])}
                                </div>
                            )}
                            {!previewVideo && previewImages.length > 1 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 w-full h-full">
                                    {previewImages.map((src) => (
                                        <div key={src} className="aspect-square bg-base-300 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center" onClick={() => openModalWithImage(src)}>
                                            {renderPreviewContent(src)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Left Column: Controls */}
                <div className="flex flex-col space-y-2">
                    <WorkflowSelector 
                      workflows={workflows}
                      selectedWorkflow={selectedWorkflow}
                      onSelect={handleWorkflowSelect}
                    />

                    <div className="bg-base-200 shadow-lg rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">Controls</h2>
                            <div className="flex items-center space-x-2">
                                <button onClick={handleOpenSavePresetModal} className="p-2 btn-sm bg-base-300 rounded-md hover:bg-base-300/70"><DocumentArrowDownIcon className="h-5 w-5" /></button>
                                <button onClick={handleOpenLoadPresetModal} className="p-2 btn-sm bg-base-300 rounded-md hover:bg-base-300/70"><FolderIcon className="h-5 w-5" /></button>
                            </div>
                        </div>
                        <DynamicForm
                            inputs={dynamicInputs
                                .filter(input => input.class_type !== 'CozyGenImageInput')
                                .map(input => {
                                    if (['CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput', 'CozyGenChoiceInput'].includes(input.class_type)) {
                                        let param_type = input.class_type.replace('CozyGen', '').replace('Input', '').toUpperCase();
                                        if (param_type === 'CHOICE') {
                                            param_type = 'DROPDOWN';
                                        }
                                        return {
                                            ...input,
                                            inputs: {
                                                ...input.inputs,
                                                param_type: param_type,
                                                Multiline: input.inputs.display_multiline || false, 
                                            }
                                        };
                                    }
                                    return input;
                                })
                            }
                            formData={formData}
                            onFormChange={handleFormChange}
                            randomizeState={randomizeState}
                            onRandomizeToggle={handleRandomizeToggle}
                            bypassedState={bypassedState}
                            onBypassToggle={handleBypassToggle}
                        />
                    </div>

                    {dynamicInputs.filter(input => input.class_type === 'CozyGenImageInput').map(input => (
                        <ImageInput
                            key={input.id}
                            input={input}
                            value={formData[input.inputs.param_name]}
                            onFormChange={handleFormChange}
                            onBypassToggle={handleBypassToggle}
                            disabled={bypassedState[input.inputs.param_name] || false}
                            isGenerating={isLoading}
                        />
                    ))}
                </div>
            </div>

            <div ref={bottomBarRef} className="fixed bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-sm p-4 border-t border-base-300 z-10 shadow-lg">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                            <label htmlFor="batch-count-input" className="text-sm font-medium text-gray-300">Batch:</label>
                            <input 
                                type="number"
                                id="batch-count-input"
                                value={batchCount}
                                onChange={handleBatchCountChange}
                                className="input input-bordered w-16 bg-base-300 text-center py-3 rounded-xl"
                                min="1"
                            />
                        </div>
                        <button
                            onClick={handleAddToQueue}
                            disabled={!workflowData || isQueuing}
                            className="flex-grow bg-accent text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg"
                        >
                            {isQueuing ? 'Queued...' : 'Add to Queue'}
                        </button>
                        <div className="relative">
                            <button
                                onClick={toggleQueuePanel}
                                className="p-4 bg-base-300 text-gray-300 rounded-lg hover:bg-base-300/70 transition-colors"
                                aria-label="Show queue"
                            >
                                <QueueListIcon className="h-6 w-6" />
                            </button>
                            {inProgressCount > 0 && (
                                <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-accent text-white text-xs flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                                    {inProgressCount}
                                </span>
                            )}
                        </div>
                    </div>
                    {(isLoading && progressMax > 0) && (
                        <div className="w-full bg-base-300 rounded-full h-2.5 mt-2">
                            <div
                                className="bg-accent h-2.5 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${(progressValue / progressMax) * 100}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>


            <Modal isOpen={isSavePresetModalOpen} onRequestClose={() => setIsSavePresetModalOpen(false)} style={customStyles} contentLabel="Save Preset">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                    <h2 className="text-2xl font-bold text-white mb-4">Save Preset</h2>
                    <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Enter preset name"
                        className="input input-bordered w-full bg-gray-700 text-white mb-4"
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsSavePresetModalOpen(false)} className="flex-grow bg-accent text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg">Cancel</button>
                        <button onClick={handleSavePreset} className="flex-grow bg-accent text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg">Save</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isLoadPresetModalOpen} onRequestClose={() => setIsLoadPresetModalOpen(false)} style={customStyles} contentLabel="Load Preset">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                    <h2 className="text-2xl font-bold text-white mb-4">Load Preset</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {presets.map(preset => (
                            <div key={preset} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                <span className="text-white">{preset.replace('.json', '')}</span>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => handleLoadPreset(preset)} className="flex-grow bg-accent text-white font-bold text-lg py-2 px-2 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg">Load</button>
                                    <button onClick={() => handleDeletePreset(preset)} className="flex-grow bg-accent text-white font-bold text-lg py-2 px-2 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg"><TrashIcon className="h-4 w-4" /></button>
                                </div>
                            </div>
                        ))}
                        {presets.length === 0 && <p className="text-gray-400">No presets found for this workflow.</p>}
                    </div>
                    <div className="flex justify-end mt-4">
                        <button onClick={() => setIsLoadPresetModalOpen(false)} className="flex-grow bg-accent text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg">Close</button>
                    </div>
                </div>
            </Modal>
            <LayerSelectionModal
                isOpen={isLayerModalOpen}
                onClose={() => setIsLayerModalOpen(false)}
                options={layerInputOptions}
                onSelect={handleLayerTargetSelection}
                title="Select Layer"
            />
            <SelectionModal
                isOpen={isImageInputModalOpen}
                onClose={() => setIsImageInputModalOpen(false)}
                options={imageInputOptions}
                onSelect={handleImageTargetSelection}
                title="Select Image Input"
            />
            {selectedPreviewImage && (
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={() => setModalIsOpen(false)}
                    style={customStyles}
                    contentLabel="Image Preview"
                >
                    <div className="flex flex-col h-full w-full">
                        <div className="flex-grow flex items-center justify-center min-h-0">
                            {renderModalContent(selectedPreviewImage)}
                        </div>
                        <div className="flex-shrink-0 p-4 flex flex-col items-center space-y-2">
                            <div className="flex justify-center items-center w-full">
                                <button
                                    onClick={() => setModalIsOpen(false)}
                                    className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="flex justify-center items-center space-x-2 pt-2 w-full">
                                <button
                                    onClick={() => window.open(selectedPreviewImage, '_blank')}
                                    className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors whitespace-nowrap"
                                >
                                    Open Tab
                                </button>
                                <button
                                    onClick={handleSendToInput}
                                    className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors whitespace-nowrap"
                                >
                                    Send to Input
                                </button>
                                <button
                                    onClick={handleSendToLayer}
                                    className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors whitespace-nowrap"
                                >
                                    Send to Layer
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
export default MainPage;
