import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line, Image } from 'react-konva';
import { SketchPicker } from 'react-color';
import { useNavigate } from 'react-router-dom';
import { useWorkflow } from '../context/WorkflowContext';
import { uploadImage } from '../api';
import SelectionModal from '../components/SelectionModal';
import { ChevronUpIcon, ChevronDownIcon, PencilIcon } from '@heroicons/react/24/solid';

const Label = ({ children, ...props }) => <label {...props} className="block text-sm font-medium text-gray-300 mb-1">{children}</label>;
const Slider = (props) => <input type="range" {...props} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />;
const Button = ({ children, onClick, className, active }) => (
    <button 
        onClick={onClick} 
        className={`px-4 py-2 rounded-md font-semibold transition-colors ${className} ${active ? 'bg-accent text-white' : 'bg-base-300 text-gray-300 hover:bg-gray-600'}`}>
        {children}
    </button>
);

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getCenter(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], {type:mime});
}

const DrawPage = () => {
    const {
        workflowData, setWorkflowData, dynamicInputs, handleFormChange, 
        layers, setLayers, stageSize, setStageSize, tool, setTool, 
        activeLayerId, setActiveLayerId, brushColor, setBrushColor, 
        brushSize, setBrushSize, brushOpacity, setBrushOpacity, 
        eraserSize, setEraserSize, stage, setStage
    } = useWorkflow();
    
    const navigate = useNavigate();
    const isDrawing = useRef(false);
    const lastDist = useRef(0);
    const stageRef = useRef(null);
    const containerRef = useRef(null);
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageInputOptions, setImageInputOptions] = useState([]);
    const [layerVersion, setLayerVersion] = useState(0);

    useEffect(() => {
        if (layers.length === 0) {
            setLayers([{ id: 1, name: 'Layer 1', isVisible: true, lines: [] }]);
        }
    }, []);

    const getRelativePointerPosition = () => {
        const stage = stageRef.current;
        if (!stage) return null;
        const transform = stage.getAbsoluteTransform().copy().invert();
        return transform.point(stage.getPointerPosition());
    };

    const handleMouseDown = (e) => {
        if (tool !== 'pen' && tool !== 'eraser') return;
        isDrawing.current = true;
        const pos = getRelativePointerPosition();
        if (!pos) return;
        const newLayers = layers.map(layer => {
            if (layer.id === activeLayerId) {
                const strokeWidth = tool === 'eraser' ? eraserSize : brushSize;
                return { ...layer, lines: [...layer.lines, { tool, points: [pos.x, pos.y], stroke: brushColor, strokeWidth, opacity: brushOpacity }] };
            }
            return layer;
        });
        setLayers(newLayers);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing.current || tool === 'navigate') return;
        const point = getRelativePointerPosition();
        if (!point) return;
        const newLayers = layers.map(layer => {
            if (layer.id === activeLayerId) {
                let lastLine = layer.lines[layer.lines.length - 1];
                if (!lastLine) return layer;
                lastLine.points = lastLine.points.concat([point.x, point.y]);
                return { ...layer, lines: [...layer.lines.slice(0, -1), lastLine] };
            }
            return layer;
        });
        setLayers(newLayers);
    };

    const handleMouseUp = () => { isDrawing.current = false; };

    const handleTouchStart = (e) => {
        if (e.evt.touches.length === 2 && tool === 'navigate') {
            const t1 = e.evt.touches[0];
            const t2 = e.evt.touches[1];
            lastDist.current = getDistance({ x: t1.clientX, y: t1.clientY }, { x: t2.clientX, y: t2.clientY });
        } else {
            handleMouseDown(e);
        }
    };

    const handleTouchMove = (e) => {
        if (e.evt.touches.length === 2 && tool === 'navigate') {
            const stage = e.target.getStage();
            const t1 = e.evt.touches[0];
            const t2 = e.evt.touches[1];
            const newDist = getDistance({ x: t1.clientX, y: t1.clientY }, { x: t2.clientX, y: t2.clientY });
            if (lastDist.current === 0) { lastDist.current = newDist; return; }
            const oldScale = stage.scaleX();
            const newScale = oldScale * (newDist / lastDist.current);
            const center = getCenter({ x: t1.clientX, y: t1.clientY }, { x: t2.clientX, y: t2.clientY });
            const mousePointTo = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };
            setStage({ scale: newScale, x: center.x - mousePointTo.x * newScale, y: center.y - mousePointTo.y * newScale });
            lastDist.current = newDist;
        } else {
            handleMouseMove(e);
        }
    };

    const handleTouchEnd = () => { lastDist.current = 0; handleMouseUp(); };

    const handleUndo = () => {
        const newLayers = layers.map(layer => {
            if (layer.id === activeLayerId) {
                return { ...layer, lines: layer.lines.slice(0, -1) };
            }
            return layer;
        });
        setLayers(newLayers);
    };

    const handleClear = () => setLayers(layers.map(l => (l.id === activeLayerId ? { ...l, lines: [] } : l)));

    const handleResetAll = () => {
        if (window.confirm("Are you sure you want to reset the entire canvas? This will clear all layers and reset all tools.")) {
            setLayers([{ id: 1, name: 'Layer 1', isVisible: true, lines: [] }]);
            setActiveLayerId(1);
            setTool('pen');
            setBrushColor('#000000');
            setBrushSize(5);
            setBrushOpacity(1);
            setEraserSize(20);
            setStage({ scale: 1, x: 0, y: 0 });
        }
    };

    const handleExport = () => {
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = 'drawing.png';
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendToInput = async () => {
        if (!workflowData) { alert('No workflow loaded.'); return; }
        const imageInputs = dynamicInputs.filter(input => input.class_type === 'CozyGenImageInput');
        if (imageInputs.length === 0) { alert('No compatible image input node found.'); return; }
        if (imageInputs.length === 1) {
            await handleImageTargetSelection(imageInputs[0].inputs.param_name);
        } else {
            setImageInputOptions(imageInputs.map(input => input.inputs.param_name));
            setIsModalOpen(true);
        }
    };

    const handleImageTargetSelection = async (selectedParamName) => {
        setIsModalOpen(false);
        if (!selectedParamName) return;
        try {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            const imageBlob = dataURLtoBlob(uri);
            const response = await uploadImage(imageBlob);
            if (!response.filename) throw new Error('Server did not return a filename.');
            const { filename } = response;
            const imageInputNode = Object.values(workflowData).find(node => node.widgets_values && node.widgets_values.includes(selectedParamName));
            const nodeId = Object.keys(workflowData).find(key => workflowData[key] === imageInputNode);
            const newWorkflowData = JSON.parse(JSON.stringify(workflowData));
            if (newWorkflowData[nodeId]) newWorkflowData[nodeId].widgets_values[0] = filename;
            setWorkflowData(newWorkflowData);
            handleFormChange(selectedParamName, filename);
            navigate('/');
        } catch (error) {
            console.error('Failed to upload or update workflow:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleRenameLayer = (layerId) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        const newName = prompt('Enter new layer name:', layer.name);
        if (newName && newName.trim() !== '') {
            const newLayers = layers.map(l => {
                if (l.id === layerId) {
                    return { ...l, name: newName };
                }
                return l;
            });
            setLayers(newLayers);
        }
    };

    const handleReorderLayer = (layerId, direction) => {
        const index = layers.findIndex(l => l.id === layerId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= layers.length) return;

        const newLayers = [...layers];
        const [movedLayer] = newLayers.splice(index, 1);
        newLayers.splice(newIndex, 0, movedLayer);

        setLayers(newLayers);
    };

    const addLayer = () => {
        const newLayer = { id: Date.now(), name: `Layer ${layers.length + 1}`, isVisible: true, lines: [] };
        setLayers([...layers, newLayer]);
        setActiveLayerId(newLayer.id);
    };

    const deleteLayer = (id) => {
        if (layers.length === 1) return;
        const newLayers = layers.filter(l => l.id !== id);
        setLayers(newLayers);
        if (activeLayerId === id) setActiveLayerId(newLayers[0].id);
    };

    const toggleLayerVisibility = (id) => {
        const newLayers = layers.map(l => {
            if (l.id === id) {
                return { ...l, isVisible: !l.isVisible };
            }
            return l;
        });
        setLayers(newLayers);
        setLayerVersion(layerVersion + 1);
    };

    const handleWheel = (e) => {
        if (tool !== 'navigate') return;
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const mousePointTo = { x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale, y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale };
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        setStage({ scale: newScale, x: (stage.getPointerPosition().x / newScale - mousePointTo.x) * newScale, y: (stage.getPointerPosition().y / newScale - mousePointTo.y) * newScale });
    };

    const handleDragEnd = (e) => setStage({ ...stage, x: e.target.x(), y: e.target.y() });
    const zoom = (factor) => setStage({ ...stage, scale: stage.scale * factor });
    const resetZoom = () => setStage({ scale: 1, x: 0, y: 0 });

    useEffect(() => {
        function checkSize() {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                const size = Math.min(width, height);
                setStageSize({ width: size, height: size });
            }
        }
        checkSize();
        window.addEventListener("resize", checkSize);
        return () => window.removeEventListener("resize", checkSize);
    }, []);

    return (
        <>
            <SelectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} options={imageInputOptions} onSelect={handleImageTargetSelection} title="Select Image Input" />
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 px-4 py-2">
                <div className="md:col-span-3 flex flex-col items-center">
                    <div ref={containerRef} className="w-full border-2 border-gray-700 rounded-lg shadow-lg bg-gray-900 overflow-hidden">
                        <Stage
                            width={stageSize.width}
                            height={stageSize.height}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                            onDragEnd={handleDragEnd}
                            draggable={tool === 'navigate'}
                            scaleX={stage.scale}
                            scaleY={stage.scale}
                            x={stage.x}
                            y={stage.y}
                            ref={stageRef}
                            style={{ touchAction: 'none' }}
                        >
                            {layers.map(layer => (
                                layer.isVisible && (
                                    <Layer key={layer.id}>
                                        {layer.lines.map((line, i) => {
                                            if (line.tool === 'image') {
                                                return <Image key={i} image={line.image} x={line.x} y={line.y} scaleX={line.scaleX} scaleY={line.scaleY} />;
                                            }
                                            return (
                                                <Line key={i} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} opacity={line.opacity} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'} />
                                            );
                                        })}
                                    </Layer>
                                )
                            ))}
                        </Stage>
                    </div>
                </div>
                <div className="md:col-span-1 flex flex-col space-y-4">
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-2 mb-3">Controls</h2>
                        <div className="space-y-3">
                            <div>
                                <Label>Tool</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <Button onClick={() => setTool('pen')} active={tool === 'pen'} className="w-full">Pen</Button>
                                    <Button onClick={() => setTool('eraser')} active={tool === 'eraser'} className="w-full">Eraser</Button>
                                    <Button onClick={() => setTool('navigate')} active={tool === 'navigate'} className="w-full">Pan/Zoom</Button>
                                    <Button onClick={handleUndo} className="w-full">Undo</Button>
                                </div>
                            </div>
                            {tool === 'navigate' && (
                                <div>
                                    <Label>Zoom</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button onClick={() => zoom(1.2)} className="w-full">In</Button>
                                        <Button onClick={() => zoom(0.8)} className="w-full">Out</Button>
                                        <Button onClick={resetZoom} className="w-full">Reset</Button>
                                    </div>
                                </div>
                            )}
                            {tool === 'pen' && (
                                <>
                                    <div>
                                        <Label>Brush Color</Label>
                                        <div className="relative">
                                            <div className="w-full h-10 p-1 bg-base-300 border border-gray-600 rounded-lg flex items-center" onClick={() => setDisplayColorPicker(!displayColorPicker)}>
                                                <div style={{ backgroundColor: brushColor }} className="w-full h-full rounded-md cursor-pointer"></div>
                                            </div>
                                            {displayColorPicker && (
                                                <div className="absolute z-20 right-0" style={{ bottom: '100%', marginBottom: '0.5rem' }}>
                                                    <div className="fixed inset-0" onClick={() => setDisplayColorPicker(false)}></div>
                                                    <SketchPicker color={brushColor} onChange={(color) => setBrushColor(color.hex)} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="brushSize">Brush Size: {brushSize}</Label>
                                        <Slider id="brushSize" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
                                    </div>
                                    <div>
                                        <Label htmlFor="brushOpacity">Brush Opacity: {brushOpacity.toFixed(2)}</Label>
                                        <Slider id="brushOpacity" min="0.01" max="1" step="0.01" value={brushOpacity} onChange={(e) => setBrushOpacity(parseFloat(e.target.value))} />
                                    </div>
                                </>
                            )}
                            {tool === 'eraser' && (
                                <div>
                                    <Label htmlFor="eraserSize">Eraser Size: {eraserSize}</Label>
                                    <Slider id="eraserSize" min="1" max="100" value={eraserSize} onChange={(e) => setEraserSize(parseInt(e.target.value, 10))} />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex-grow">
                        <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-2 mb-3">Layers</h2>
                        <div className="space-y-2 h-48 overflow-y-auto pr-2">
                            {layers.map(layer => (
                                <div key={`${layer.id}-${layerVersion}`} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${activeLayerId === layer.id ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600'} border ${!layer.isVisible ? 'text-gray-500' : ''}`} onClick={() => setActiveLayerId(layer.id)}>
                                    <span className="font-medium">{layer.name}</span>
                                    <div className="flex items-center space-x-3">
                                        <button onClick={(e) => { e.stopPropagation(); handleReorderLayer(layer.id, 'up'); }} disabled={layers[0].id === layer.id} className="text-gray-300 hover:text-white disabled:opacity-50">
                                            <ChevronUpIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleReorderLayer(layer.id, 'down'); }} disabled={layers[layers.length - 1].id === layer.id} className="text-gray-300 hover:text-white disabled:opacity-50">
                                            <ChevronDownIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleRenameLayer(layer.id); }} className="text-gray-300 hover:text-white">
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className={`text-gray-300 hover:text-white ${!layer.isVisible ? 'text-gray-500' : ''}`}>
                                            {layer.isVisible ? 
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg> : 
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-gray-400 hover:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button onClick={addLayer} className="w-full">Add Layer</Button>
                            <Button onClick={handleClear} className="w-full">Clear Layer</Button>
                        </div>
                    </div>

                    {/* Actions Control Box */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-2 mb-3">Actions</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={handleResetAll} className="w-full bg-red-600">Reset All</Button>
                            <Button onClick={handleExport} className="w-full">Export PNG</Button>
                            <Button onClick={handleSendToInput} className="w-full bg-accent col-span-2">Send to Image Input</Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DrawPage;