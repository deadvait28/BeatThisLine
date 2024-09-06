import React, { useRef, useEffect } from 'react';

function DrawingCanvas({ width, height, lineThickness, onDrawingComplete }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set the initial canvas background
    ctx.fillStyle = '#001100'; // Very dark green background
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#00FF00'; // Bright green color for drawing
    ctx.lineWidth = lineThickness;
    ctx.lineCap = 'round';

    const startDrawing = (e) => {
      isDrawing.current = true;
      draw(e);
    };

    const stopDrawing = () => {
      isDrawing.current = false;
      ctx.beginPath();
      onDrawingComplete(canvas);
    };

    const draw = (e) => {
      if (!isDrawing.current) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);

      onDrawingComplete(canvas);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
    };
  }, [width, height, lineThickness, onDrawingComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ cursor: 'crosshair' }}
    />
  );
}

export default DrawingCanvas;