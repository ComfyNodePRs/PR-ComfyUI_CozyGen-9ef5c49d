import React from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#2D3748', // bg-base-200
    border: '1px solid #4A5568', // border-gray-600
    borderRadius: '8px',
    padding: '1.5rem',
    maxWidth: '90vw',
    width: '500px',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 1000,
  },
};

Modal.setAppElement('#root');

const LayerSelectionModal = ({ isOpen, onClose, options, onSelect, title }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={customStyles}
      contentLabel={title}
    >
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="mb-6">Please choose a destination layer:</p>
        <div className="flex flex-col space-y-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="w-full px-4 py-3 bg-base-300 text-white font-semibold rounded-lg hover:bg-accent-focus transition duration-300"
            >
              {option.name}
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
            <button
                onClick={onClose}
                className="px-4 py-2 bg-transparent text-gray-400 rounded-md hover:text-white transition-colors"
            >
                Cancel
            </button>
        </div>
      </div>
    </Modal>
  );
};

LayerSelectionModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
    })).isRequired,
    onSelect: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
};

export default LayerSelectionModal;
