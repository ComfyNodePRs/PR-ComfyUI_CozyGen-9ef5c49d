import React from 'react';

const isVideo = (filename) => /\.(mp4|webm)$/i.test(filename);
const isAudio = (filename) => /\.(mp3|wav|flac)$/i.test(filename);

const GalleryItem = ({ item, onSelect, onHide }) => {
    const isDirectory = item.type === 'directory';
    const fileUrl = isDirectory ? '' : `/view?filename=${item.filename}&subfolder=${item.subfolder}&type=output`;

    const handleHideClick = (e) => {
        e.stopPropagation();
        onHide(item);
    };

    const renderContent = () => {
        if (isDirectory) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-base-300/50">
                    <svg className="w-16 h-16 text-gray-500 group-hover:text-accent transition-colors" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                </div>
            );
        } else if (isVideo(item.filename)) {
            return <video src={fileUrl} muted className="w-full h-full object-cover" />;
        } else if (isAudio(item.filename)) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-base-300/50">
                    <svg className="w-16 h-16 text-gray-500 group-hover:text-accent transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
                </div>
            );
        } else {
            return <img src={fileUrl} alt={item.filename} className="w-full h-full object-cover" />;
        }
    };

    return (
        <div 
            className={`bg-base-200 rounded-lg shadow-lg overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-all duration-300 ${item.hidden ? 'opacity-50' : ''}`}
            onClick={() => onSelect(item)}
        >
            <div className="relative w-full h-48">
                {renderContent()}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end p-2">
                    {isDirectory && (
                        <button onClick={handleHideClick} className="text-white bg-gray-800 bg-opacity-50 rounded-full p-1 hover:bg-opacity-75">
                            {item.hidden ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.523l8.367 8.367zm1.414-1.414L6.523 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    )}
                </div>
            </div>
            <p className="p-2 text-sm text-white truncate">{item.filename}</p>
        </div>
    );
}

export default GalleryItem;