import React, { useState, useEffect } from 'react';
import { Image } from 'react-konva';

const URLImage = ({ src, x, y, scaleX, scaleY }) => {
    const [image, setImage] = useState(null);

    useEffect(() => {
        const img = new window.Image();
        img.src = src;
        img.crossOrigin = 'Anonymous'; // Handle potential CORS issues if loading from external URLs
        img.onload = () => {
            setImage(img);
        };
        img.onerror = () => {
            console.error(`Failed to load image from src: ${src}`);
        }
    }, [src]);

    return <Image image={image} x={x} y={y} scaleX={scaleX} scaleY={scaleY} />;
};

export default URLImage;