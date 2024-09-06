import React, { useRef, useEffect, useCallback } from 'react';

const BeatVisualizer = ({ beatData, width, height, currentTime }) => {
  const canvasRef = useRef(null);

  const drawVisualization = useCallback((ctx) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / 32;
    const barSpacing = 2;

    beatData.forEach((beat, index) => {
      const barHeight = Math.max(1, beat.intensity * height * 2); // Increased multiplier for more visible changes
      const x = index * (barWidth + barSpacing);
      const y = height - barHeight;

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, '#00FF00');
      gradient.addColorStop(1, '#FFFF00');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    });

    // Draw playhead
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(currentTime * width, 0, 2, height);

  }, [beatData, currentTime, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawVisualization(ctx);
  }, [drawVisualization]);

  return <canvas ref={canvasRef} width={width} height={height} className="beat-visualizer" />;
};

export default BeatVisualizer;