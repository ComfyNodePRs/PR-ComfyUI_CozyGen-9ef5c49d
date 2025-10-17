import React, { useState } from 'react';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useWorkflow } from '../context/WorkflowContext';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import LayerSelectionModal from './LayerSelectionModal';
import SelectionModal from './SelectionModal';
import { uploadImage } from '../api';

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

const isVideo = (url) => /\.(mp4|webm)/i.test(url);

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

const QueuePanel = () => {
  const { isQueuePanelOpen, toggleQueuePanel, queue, layers, stageSize, dynamicInputs, workflowData, handleFormChange, setLayers } = useWorkflow();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();
  const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
  const [layerInputOptions, setLayerInputOptions] = useState([]);
  const [isImageInputModalOpen, setIsImageInputModalOpen] = useState(false);
  const [imageInputOptions, setImageInputOptions] = useState([]);

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedImage(null);
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
      if (!selectedLayerId || !selectedImage) return;

      try {
          const imageBlob = await fetch(selectedImage).then(r => r.blob());
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
      if (!selectedParamName || !selectedImage) return;

      try {
          const imageBlob = await fetch(selectedImage).then(r => r.blob());
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


  if (!isQueuePanelOpen) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const inProgressJobs = queue.filter(job => job.status === 'pending' || job.status === 'running');
  const completedJobs = queue.filter(job => job.status === 'completed' || job.status === 'error');

  const renderJob = (job) => (
    <div key={job.id} className="bg-base-100 p-3 rounded-lg shadow flex items-center space-x-4">
      {job.thumbnailUrl ? (
        isVideo(job.thumbnailUrl) ? (
          <video src={job.thumbnailUrl} muted className="w-10 h-10 rounded-md object-cover flex-shrink-0 cursor-pointer" onClick={() => openModal(job.thumbnailUrl)} />
        ) : (
          <img src={job.thumbnailUrl} alt="Job thumbnail" className="w-10 h-10 rounded-md object-cover flex-shrink-0 cursor-pointer" onClick={() => openModal(job.thumbnailUrl)} />
        )
      ) : (
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(job.status)}`} title={`Status: ${job.status}`}></div>
      )}
      <div className="flex-grow overflow-hidden">
        <p className="text-sm font-semibold text-white truncate" title={job.workflowName}>
          {job.workflowName}
        </p>
        <p className="text-xs text-gray-400 truncate" title={`Job ID: ${job.id}`}>
          Job #{job.id.slice(-6)}
        </p>
      </div>
      <button disabled className="p-2 rounded-md opacity-50 cursor-not-allowed">
        <TrashIcon className="h-5 w-5 text-red-500" />
      </button>
    </div>
  );

  return (
    <>
      <div className="fixed top-0 right-0 h-full w-full md:w-96 bg-base-200 shadow-lg z-50 transform transition-transform duration-300 ease-in-out"
           style={{ transform: isQueuePanelOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="flex justify-between items-center p-4 border-b border-base-300">
          <h2 className="text-xl font-semibold text-white">Generation Queue</h2>
          <button onClick={toggleQueuePanel} className="p-1 rounded-full hover:bg-base-300">
            <XMarkIcon className="h-6 w-6 text-gray-300" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100%-4rem)]">
          {queue.length === 0 ? (
            <p className="text-gray-400 text-center">The queue is empty.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">In Progress</h3>
                <div className="space-y-2">
                  {inProgressJobs.length > 0 ? inProgressJobs.map(renderJob) : <p className="text-sm text-gray-500">No jobs in progress.</p>}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Completed</h3>
                <div className="space-y-2">
                  {completedJobs.length > 0 ? completedJobs.map(renderJob) : <p className="text-sm text-gray-500">No completed jobs.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedImage && (
        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          style={customStyles}
          contentLabel="Image Preview"
        >
          <div className="flex flex-col h-full w-full">
            <div className="flex-grow flex items-center justify-center min-h-0">
              {renderModalContent(selectedImage)}
            </div>
                          <div className="flex-shrink-0 p-4 flex flex-col items-center space-y-2">
                          <div className="flex justify-center items-center w-full">
                            <button
                              onClick={closeModal}
                              className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                            >
                              Close
                            </button>
                          </div>
                          <div className="flex justify-center items-center space-x-2 pt-2 w-full">
                              <button
                                  onClick={() => window.open(selectedImage, '_blank')}
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
                  />    </>
  );
};

export default QueuePanel;
