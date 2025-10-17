import { useEffect, useRef } from 'react';

export const useViewportFix = () => {
    const elementRef = useRef(null);

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return; // Exit if the API is not supported

        const handler = () => {
            if (elementRef.current) {
                // Calculate the height of the keyboard
                const keyboardHeight = viewport.height - viewport.offsetTop - viewport.height;
                // On some OS, the offset can be negative when keyboard is gone
                const bottomOffset = Math.max(0, keyboardHeight);
                elementRef.current.style.transform = `translateY(-${bottomOffset}px)`;
            }
        };

        viewport.addEventListener('resize', handler);
        // Call it once to set initial position if needed
        handler();

        return () => {
            viewport.removeEventListener('resize', handler);
            // Reset style on cleanup
            if (elementRef.current) {
                elementRef.current.style.transform = 'translateY(0px)';
            }
        };
    }, []);

    return elementRef;
};