import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGallery, fetchImageBlob, uploadImage, toggleFolderVisibility } from '../api';
import GalleryItem from '../components/GalleryItem';
import Modal from 'react-modal'; // Using react-modal for accessibility
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useWorkflow } from '../context/WorkflowContext';
import SelectionModal from '../components/SelectionModal';
import LayerSelectionModal from '../components/LayerSelectionModal';
import { useViewportFix } from '../hooks/useViewportFix';

// Modal styles

// Modal styles
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

const isVideo = (filename) => /\.(mp4|webm)$/i.test(filename);
const isAudio = (filename) => /\.(mp3|wav|flac)$/i.test(filename);

const Gallery = () => {
    const [items, setItems] = useState([]);
    const [path, setPath] = useState(localStorage.getItem('galleryPath') || '');
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(parseInt(localStorage.getItem('galleryPageSize'), 10) || 20);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageInputOptions, setImageInputOptions] = useState([]);

    const paginationBarRef = useViewportFix();

    const navigate = useNavigate();
    const { workflowData, setWorkflowData, dynamicInputs, handleFormChange, layers, setLayers, stageSize } = useWorkflow();

    const [showHidden, setShowHidden] = useState(false);
    const [titleClickCount, setTitleClickCount] = useState(0);

    const handleTitleClick = () => {
        const newClickCount = titleClickCount + 1;
        setTitleClickCount(newClickCount);
        if (newClickCount >= 5) {
            setShowHidden(!showHidden);
            setTitleClickCount(0);
        }
    };

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const galleryData = await getGallery(path, page, pageSize, showHidden);
                if (galleryData && galleryData.items) {
                    setItems(galleryData.items);
                    setTotalPages(galleryData.total_pages);
                } else {
                    setItems([]);
                    setTotalPages(1);
                }
            } catch (error) {
                console.error(error);
                setItems([]);
                setTotalPages(1);
            }
        };
        fetchGallery();
        localStorage.setItem('galleryPath', path);
    }, [path, page, pageSize, showHidden]);

    const handleSelect = (item) => {
        if (item.type === 'directory') {
            setPath(item.subfolder);
            setPage(1);
        } else {
            setSelectedItem(item);
            setModalIsOpen(true);
        }
    };

    const handlePageSizeChange = (e) => {
        const newSize = parseInt(e.target.value, 10);
        setPageSize(newSize);
        setPage(1); // Reset to first page when page size changes
        localStorage.setItem('galleryPageSize', newSize);
    };

    const handleBreadcrumbClick = (index) => {
        const normalizedPath = path.replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        const newPath = pathSegments.slice(0, index).join('/');
        setPath(newPath);
        setPage(1);
    };

    const handleFolderUp = () => {
        const normalizedPath = path.replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            const newPath = pathSegments.slice(0, -1).join('/');
            setPath(newPath);
        } else {
            setPath(''); // Already at root, ensure path is empty
        }
        setPage(1);
    };

    const handleImageTargetSelection = async (selectedParamName) => {
        setIsModalOpen(false);
        if (!selectedParamName || !selectedItem) return;

        const imageInputUI = dynamicInputs.find(input => input.inputs.param_name === selectedParamName);
        if (!imageInputUI) {
            alert('Selected image input not found.');
            return;
        }

        const targetNode = Object.values(workflowData).find(node => node.id === imageInputUI.id);
        if (!targetNode) {
            alert('Could not find a target node in the workflow.');
            return;
        }

        try {
            const nodeId = Object.keys(workflowData).find(key => workflowData[key] === targetNode);
            const imageUrl = `/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`;
            const imageBlob = await fetchImageBlob(imageUrl);
            const uploadResponse = await uploadImage(new File([imageBlob], selectedItem.filename));
            const filename = uploadResponse.filename;

            if (!filename) {
                throw new Error('Upload server did not return a filename.');
            }

            const newWorkflowData = JSON.parse(JSON.stringify(workflowData));
            if (newWorkflowData[nodeId].inputs) {
                newWorkflowData[nodeId].inputs.image_filename = filename;
            } else {
                newWorkflowData[nodeId].widgets_values = [filename];
            }
            setWorkflowData(newWorkflowData);

            handleFormChange(selectedParamName, filename);
            navigate('/');

        } catch (error) {
            console.error("Error sending image to input:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleLayerTargetSelection = async (selectedLayerId) => {
        setIsLayerModalOpen(false);
        if (!selectedLayerId || !selectedItem) return;

        try {
            const imageUrl = `/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`;
            const imageBlob = await fetchImageBlob(imageUrl);
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
            setIsModalOpen(true);
        }
    };

    const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
    const [layerInputOptions, setLayerInputOptions] = useState([]);


    const handleSendToLayer = async () => {
        if (layers.length === 0) {
            alert('No layers found in the draw page.');
            return;
        }
        setLayerInputOptions(layers);
        setIsLayerModalOpen(true);
    };

    const handleNext = () => {
        const mediaItems = items.filter(item => item.type !== 'directory');
        if (mediaItems.length <= 1) return;
        const currentIndex = mediaItems.findIndex(item => item.filename === selectedItem.filename && item.subfolder === selectedItem.subfolder);
        const nextIndex = (currentIndex + 1) % mediaItems.length;
        setSelectedItem(mediaItems[nextIndex]);
    };

    const handlePrevious = () => {
        const mediaItems = items.filter(item => item.type !== 'directory');
        if (mediaItems.length <= 1) return;
        const currentIndex = mediaItems.findIndex(item => item.filename === selectedItem.filename && item.subfolder === selectedItem.subfolder);
        const prevIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
        setSelectedItem(mediaItems[prevIndex]);
    };

    const renderModalContent = () => {
        if (!selectedItem) return null;

        const fileUrl = `/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`;

        if (isVideo(selectedItem.filename)) {
            return <video src={fileUrl} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-lg" />;
        } else if (isAudio(selectedItem.filename)) {
            return <audio src={fileUrl} controls autoPlay loop className="w-full" />;
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
                        <img src={fileUrl} alt={selectedItem.filename} className="max-w-full max-h-full object-contain rounded-lg" />
                    </TransformComponent>
                </TransformWrapper>
            );
        }
    };

    const handleHideFolder = async (item) => {
        try {
            await toggleFolderVisibility(item.subfolder);
            // Refetch the gallery to show the updated hidden status
            const galleryData = await getGallery(path, page, pageSize, showHidden);
            if (galleryData && galleryData.items) {
                setItems(galleryData.items);
                setTotalPages(galleryData.total_pages);
            } else {
                setItems([]);
                setTotalPages(1);
            }
        } catch (error) {
            console.error("Error toggling folder visibility:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const breadcrumbs = path.split(/[\/]/).filter(Boolean); // Handle both windows and unix paths

    return (
        <>
            <SelectionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                options={imageInputOptions}
                onSelect={handleImageTargetSelection}
                title="Select Image Input"
            />
            <LayerSelectionModal
                isOpen={isLayerModalOpen}
                onClose={() => setIsLayerModalOpen(false)}
                options={layerInputOptions}
                onSelect={handleLayerTargetSelection}
                title="Select Layer"
            />
            <div className="p-4 pb-28">
                <div className="mb-4 bg-base-200 rounded-lg p-2 flex items-center text-lg">
                <span onClick={handleTitleClick} className="cursor-pointer hover:text-accent transition-colors">Gallery</span>
                {breadcrumbs.map((segment, index) => (
                    <React.Fragment key={index}>
                        <span className="mx-2 text-gray-500">/</span>
                        <span onClick={() => handleBreadcrumbClick(index + 1)} className="cursor-pointer hover:text-accent transition-colors">{segment}</span>
                    </React.Fragment>
                ))}
                {/* Folder Up Button */}
                <button
                    onClick={handleFolderUp}
                    disabled={path === ''} // Disable if at root
                    className="ml-auto px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                    Up
                </button>
            </div>

            <div ref={paginationBarRef} className="fixed bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-sm p-4 border-t border-base-300 z-10 shadow-lg">
                <div className="max-w-2xl mx-auto flex justify-center items-center space-x-4">
                    <button
                        onClick={() => setPage(page > 1 ? page - 1 : 1)}
                        disabled={page <= 1}
                        className="px-4 py-2 bg-base-300 text-white rounded-md disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                        disabled={page >= totalPages}
                        className="px-4 py-2 bg-base-300 text-white rounded-md disabled:opacity-50"
                    >
                        Next
                    </button>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="page-size-selector" className="text-sm">Per Page:</label>
                        <select
                            id="page-size-selector"
                            className="select select-bordered select-sm bg-base-100"
                            value={pageSize}
                            onChange={handlePageSizeChange}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map(item => (
                    <GalleryItem key={item.filename} item={item} onSelect={handleSelect} onHide={handleHideFolder} />
                ))}
            </div>

            {selectedItem && (
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={() => setModalIsOpen(false)}
                    style={customStyles}
                    contentLabel="Image Preview"
                >
                    <div className="flex flex-col h-full w-full">
                        <div className="flex-grow flex items-center justify-center min-h-0">
                            {renderModalContent()}
                        </div>
                        <div className="flex-shrink-0 p-4 flex flex-col items-center space-y-2">
                            <div className="flex justify-center items-center space-x-4 w-full">
                                <button
                                    onClick={handlePrevious}
                                    className="p-2 bg-base-300 text-gray-300 rounded-full hover:bg-base-300/70 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setModalIsOpen(false)}
                                    className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="p-2 bg-base-300 text-gray-300 rounded-full hover:bg-base-300/70 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex justify-center items-center space-x-2 pt-2 w-full">
                                <button
                                    onClick={() => window.open(`/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`, '_blank')}
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
        </>
    );
}

export default Gallery;