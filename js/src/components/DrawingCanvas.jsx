import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import PropTypes from 'prop-types';

const DrawingCanvas = forwardRef(({ width, height, brushColor, brushSize, brushOpacity }, ref) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const isDrawing = useRef(false);
    const history = useRef([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const downPos = useRef(null); // To detect clicks vs. drags

    // Function to redraw the canvas from a specific history point

    // Function to redraw the canvas from a specific history point
    const redrawCanvas = (index) => {
        if (!history.current[index]) return;
        const canvas = canvasRef.current;
        const context = contextRef.current;
        const dataUrl = history.current[index];
        
        const img = new Image();
        img.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = dataUrl;
        localStorage.setItem('cozygen-drawing', dataUrl);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.imageSmoothingEnabled = true;
        contextRef.current = context;

        const savedDrawing = localStorage.getItem('cozygen-drawing');

        if (savedDrawing) {
            history.current = [savedDrawing];
            setHistoryIndex(0);
            redrawCanvas(0);
        } else {
            // If no saved drawing, create a blank initial state
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const initialState = canvas.toDataURL();
            history.current = [initialState];
            setHistoryIndex(0);
        }
    }, [width, height]);

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = brushColor;
            contextRef.current.lineWidth = brushSize;
            contextRef.current.globalAlpha = brushOpacity;
            contextRef.current.globalCompositeOperation = 'source-over';
        }
    }, [brushColor, brushSize, brushOpacity]);

    const getEventPosition = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (event.touches && event.touches.length > 0) {
            return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
        }
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const startDrawing = (event) => {
        event.preventDefault();
        const pos = getEventPosition(event);
        downPos.current = { x: pos.x, y: pos.y, time: Date.now() }; // Record start pos and time

        contextRef.current.beginPath();
        contextRef.current.moveTo(pos.x, pos.y);
        isDrawing.current = true;
    };

    const stopDrawing = (event) => {
        event.preventDefault();
        const upPos = getEventPosition(event);

        // Check if it was a click or a drag
        const dist = Math.hypot(upPos.x - downPos.current.x, upPos.y - downPos.current.y);
        const time = Date.now() - downPos.current.time;

        if (isDrawing.current && dist < 5 && time < 200) { // It's a click
            if (onCanvasClick) {
                onCanvasClick(event);
            }
        }

        if (isDrawing.current) {
            contextRef.current.closePath();
            isDrawing.current = false;

            // Only save to history if it was a drag, not a click
            if (dist > 2) { 
                const newHistory = history.current.slice(0, historyIndex + 1);
                const dataUrl = canvasRef.current.toDataURL();
                newHistory.push(dataUrl);
                history.current = newHistory;
                setHistoryIndex(newHistory.length - 1);
                localStorage.setItem('cozygen-drawing', dataUrl);
            }
        }
        downPos.current = null;
    };

    const draw = (event) => {
        if (!isDrawing.current) return;
        event.preventDefault();
        const { x, y } = getEventPosition(event);
        contextRef.current.lineTo(x, y);
        contextRef.current.stroke();
    };

    useImperativeHandle(ref, () => ({
        canvasElement: canvasRef.current, // Expose the canvas element
        startDrawing,
        undo() {
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                redrawCanvas(newIndex);
            }
        },
        clear() {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            
            const currentAlpha = context.globalAlpha;
            context.globalAlpha = 1.0;
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalAlpha = currentAlpha;

            const initialState = canvas.toDataURL();
            history.current = [initialState];
            setHistoryIndex(0);
            localStorage.removeItem('cozygen-drawing');
        },
        pickColor(event) {
            const { x, y } = getEventPosition(event);
            const pixel = contextRef.current.getImageData(x, y, 1, 1);
            const data = pixel.data;
            const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            return rgbToHex(data[0], data[1], data[2]);
        },
        getImageBlob() {
            return new Promise((resolve, reject) => {
                canvasRef.current.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to create blob from canvas.'));
                }, 'image/png');
            });
        }
    }));

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border border-gray-500 rounded-lg bg-white"
            style={{ touchAction: 'none' }}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            onTouchMove={draw}
        />
    );
});

DrawingCanvas.propTypes = {
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    brushColor: PropTypes.string.isRequired,
    brushSize: PropTypes.number.isRequired,
    brushOpacity: PropTypes.number.isRequired,
};

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
