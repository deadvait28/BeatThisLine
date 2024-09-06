import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import DrawingCanvas from './DrawingCanvas';
import BeatVisualizer from './components/BeatVisualizer';

const COMPONENT_WIDTH = 800;

function App() {
  const [lineThickness, setLineThickness] = useState(2);
  const [debugInfo, setDebugInfo] = useState('');
  const [audioContext, setAudioContext] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef(null);
  const [beatData, setBeatData] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const animationRef = useRef();
  const startTimeRef = useRef(0);
  const durationRef = useRef(10); // 10-second loop

  useEffect(() => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context initialized:', ctx);
      setAudioContext(ctx);
    }

    return () => {
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().then(() => {
          console.log('Audio context closed successfully');
        }).catch((error) => {
          console.error('Error closing audio context:', error);
        });
      }
    };
  }, [audioContext]);

  const handleDrawingComplete = useCallback((canvas) => {
    if (!canvas) return;
    canvasRef.current = canvas;
    setDebugInfo('Drawing updated. Ready to generate beat.');
  }, []);

  const handleThicknessChange = (e) => {
    setLineThickness(Number(e.target.value));
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear the entire canvas
      ctx.clearRect(0, 0, canvas.width, 400);
      
      // Reset the canvas background to very dark green
      ctx.fillStyle = '#001100';
      ctx.fillRect(0, 0, canvas.width, 400);
      
      // Reset the drawing context properties
      ctx.lineWidth = lineThickness;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#00FF00'; // Bright green color
      
      // Reset the path
      ctx.beginPath();
    }
    setDebugInfo('Canvas cleared.');
    
    // Reset the waveform
    const { waveform, coordinates } = analyzeWaveform();
    console.log('Cleared waveform:', waveform);
    console.log('Cleared coordinates:', coordinates);

    setBeatData([]);
    setCurrentTime(0);
  };

  const createKick = (time, frequency = 50, decay = 0.5) => {
    console.log(`Creating kick: time=${time}, frequency=${frequency}, decay=${decay}`);
    if (!audioContext) {
      console.error('Audio context is null in createKick');
      return;
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    // Ensure frequency is finite and positive
    frequency = Math.max(1, isFinite(frequency) ? frequency : 50);
    
    // Ensure decay is finite and positive
    decay = Math.max(0.01, isFinite(decay) ? decay : 0.5);

    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, frequency * 0.01), time + decay);
    gain.gain.setValueAtTime(0.8, time); // Slightly reduced from 1
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + decay);
    console.log('Kick created and scheduled');
  };

  const createSnare = (time, frequency = 200, decay = 0.2) => {
    if (!audioContext) {
      console.error('Audio context is null in createSnare');
      return;
    }
    // Ensure frequency is finite and positive
    frequency = Math.max(100, Math.min(500, isFinite(frequency) ? frequency : 200));
    
    // Ensure decay is finite and positive
    decay = Math.max(0.05, Math.min(0.5, isFinite(decay) ? decay : 0.2));

    const noise = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();

    const bufferSize = audioContext.sampleRate * 0.2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.8, time); // Slightly reduced from 1
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    osc.frequency.setValueAtTime(frequency, time);
    oscGain.gain.setValueAtTime(0.6, time); // Slightly reduced from 0.7
    oscGain.gain.exponentialRampToValueAtTime(Math.max(0.01, 0.01), time + decay * 0.5);

    noise.connect(noiseGain);
    osc.connect(oscGain);
    noiseGain.connect(audioContext.destination);
    oscGain.connect(audioContext.destination);

    noise.start(time);
    osc.start(time);
    noise.stop(time + decay);
    osc.stop(time + decay);
  };

  const createHiHat = (time, frequency = 6000, decay = 0.08) => {
    if (!audioContext) {
      console.error('Audio context is null in createHiHat');
      return;
    }
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const bandpass = audioContext.createBiquadFilter();
    const lowpass = audioContext.createBiquadFilter();

    // Use noise instead of a square wave
    osc.type = 'white';

    // Limit the frequency range
    frequency = Math.min(Math.max(isFinite(frequency) ? frequency : 6000, 3000), 8000);

    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(frequency, time);
    bandpass.Q.setValueAtTime(0.7, time);

    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(frequency * 1.5, time);

    // Increase minimum decay time
    decay = Math.max(isFinite(decay) ? decay : 0.08, 0.05);
    gainNode.gain.setValueAtTime(0.5, time); // Increased from 0.3
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + decay);

    osc.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc.start(time);
    osc.stop(time + decay);
  };

  const createTom = (time, frequency = 100, decay = 0.3) => {
    if (!audioContext) {
      console.error('Audio context is null in createTom');
      return;
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, time + decay);
    gain.gain.setValueAtTime(0.6, time); // Slightly reduced from 0.7
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + decay);
  };

  const createClap = (time, decay = 0.3) => {
    if (!audioContext) {
      console.error('Audio context is null in createClap');
      return;
    }
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    const bufferSize = audioContext.sampleRate * 0.2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.5;

    gain.gain.setValueAtTime(0.8, time); // Slightly reduced from 1
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    noise.start(time);
    noise.stop(time + decay);
  };

  const createBass = (time, frequency, duration) => {
    if (!audioContext) {
      console.error('Audio context is null in createBass');
      return;
    }
    // Ensure frequency is finite and positive
    frequency = Math.max(20, Math.min(200, isFinite(frequency) ? frequency : 40));
    
    // Ensure duration is finite and positive
    duration = Math.max(0.1, Math.min(2, isFinite(duration) ? duration : 0.2));

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.6, time); // Slightly reduced from 0.7
    gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0, duration));
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + Math.max(0, duration));
  };

  const playBeat = () => {
    console.log('playBeat function called');
    if (!audioContext || audioContext.state === 'closed') {
      console.log('Audio context not initialized or closed, creating a new one');
      const newContext = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(newContext);
      newContext.resume().then(() => {
        console.log('New audio context created and resumed');
        actuallyPlayBeat(newContext);
      });
    } else if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('Audio context resumed successfully');
        actuallyPlayBeat(audioContext);
      });
    } else {
      actuallyPlayBeat(audioContext);
    }
  };

  const actuallyPlayBeat = (context) => {
    console.log('actuallyPlayBeat called with context:', context);
    const { waveform, coordinates } = analyzeWaveform();
    console.log('Waveform:', waveform);
    console.log('Coordinates:', coordinates);
    
    if (waveform.every(v => v === 0.5)) {
      console.warn('No waveform detected');
      setDebugInfo('No waveform detected. Please draw something.');
      setIsPlaying(false);
      return;
    }

    console.log('Valid waveform detected, proceeding with beat generation');

    setIsPlaying(true);
    setDebugInfo('Playing beat...');

    const duration = 10; // 10-second loop
    const bpm = 100 + Math.floor(waveform[0] * 100); // BPM range: 100-200
    const beatDuration = 60 / bpm;
    const startTime = context.currentTime;

    console.log(`Beat parameters: duration=${duration}, bpm=${bpm}, beatDuration=${beatDuration}, startTime=${startTime}`);

    const updateBeatData = () => {
      const elapsedTime = (context.currentTime - startTimeRef.current) % durationRef.current;
      const currentIndex = Math.floor((elapsedTime / durationRef.current) * waveform.length);
      
      // Update beat data for the last 32 samples
      const newBeatData = [];
      for (let i = 0; i < 32; i++) {
        const index = (currentIndex + i) % waveform.length;
        const intensity = waveform[index];
        // Add some randomness to make it more dynamic
        const randomFactor = 0.5 + Math.random() * 0.5;
        newBeatData.push({ time: (index / waveform.length), intensity: intensity * randomFactor });
      }
      
      setBeatData(newBeatData);
      setCurrentTime(elapsedTime / durationRef.current);

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(updateBeatData);
      }
    };

    setIsPlaying(true);
    startTimeRef.current = startTime;
    durationRef.current = duration;
    updateBeatData();
    console.log('Initial beat data update called');

    // Generate actual beat sounds
    for (let i = 0; i < duration * bpm / 60; i++) {
      const time = startTime + i * beatDuration;
      const waveformIndex = Math.floor((i / (duration * bpm / 60)) * waveform.length);
      const waveformValue = waveform[waveformIndex] || 0;
      const normalizedValue = (waveformValue - 0.5) * 2; // Normalize to -1 to 1 range

      const coord = coordinates[waveformIndex] || { minY: 0, maxY: 400, avgY: 0.5 };
      const verticalRange = (coord.maxY - coord.minY) / 400;
      const verticalPosition = coord.avgY / 400; // Normalize to 0-1 range

      // Add console.log statements for debugging
      console.log(`Beat ${i}: time=${time}, waveformValue=${waveformValue}, normalizedValue=${normalizedValue}`);

      // Kick pattern
      if (Math.random() < normalizedValue * 0.8) {
        console.log('Triggering kick');
        const kickFreq = Math.max(20, Math.min(200, 30 + normalizedValue * 170));
        const kickDecay = Math.max(0.05, Math.min(0.3, 0.05 + normalizedValue * 0.25));
        createKick(time, kickFreq, kickDecay);
        console.log(`Kick: freq=${kickFreq}, decay=${kickDecay}`);
      }

      // Snare pattern
      if (Math.random() < (1 - normalizedValue) * 0.8) {
        console.log('Triggering snare');
        const snareFreq = Math.max(100, Math.min(500, 100 + normalizedValue * 400));
        const snareDecay = Math.max(0.05, Math.min(0.3, 0.05 + (1 - normalizedValue) * 0.25));
        createSnare(time, snareFreq, snareDecay);
      }

      // Hi-hat pattern
      const hiHatSubdivisions = 2 + Math.floor(normalizedValue * 4); // Kept the same
      for (let j = 0; j < hiHatSubdivisions; j++) {
        if (Math.random() < 0.7) { // Increased probability from 0.6 to 0.7
          console.log('Triggering hi-hat');
          const hiHatTime = time + j * beatDuration / hiHatSubdivisions;
          const hiHatFreq = 3000 + normalizedValue * 5000; // Kept the same
          const hiHatDecay = Math.max(0.05, Math.min(0.1, 0.05 + normalizedValue * 0.05));
          createHiHat(hiHatTime, hiHatFreq, hiHatDecay);
        }
      }

      // Tom pattern
      if (Math.random() < verticalRange * (1 + normalizedValue * 0.5)) {
        console.log('Triggering tom');
        const tomFreq = 80 + (1 - normalizedValue) * 220 + verticalRange * 200;
        const tomDecay = 0.1 + normalizedValue * 0.2 + verticalPosition * 0.2;
        createTom(time, tomFreq, tomDecay);
      }

      // Clap pattern
      if (Math.random() < normalizedValue * 0.5 * (verticalPosition > 0.6 ? 0.8 : 0.3)) {
        console.log('Triggering clap');
        const clapDecay = 0.2 + normalizedValue * 0.2 + verticalRange * 0.2;
        createClap(time, clapDecay);
      }

      // Bass pattern
      if (Math.random() < (1 - normalizedValue) * 0.6) {
        console.log('Triggering bass');
        const bassFreq = Math.max(20, Math.min(200, 20 + (1 - normalizedValue) * 180));
        const bassDuration = Math.max(0.1, Math.min(1, 0.1 + normalizedValue * 0.9));
        createBass(time, bassFreq, bassDuration);
      }

      // Update beat data in real-time
      setTimeout(() => {
        updateBeatData();
      }, (time - startTime) * 1000);
    }

    setTimeout(() => {
      setIsPlaying(false);
      setDebugInfo('Beat playback completed.');
      cancelAnimationFrame(animationRef.current);
    }, duration * 1000);

    console.log('Beat generation completed');
  };

  const analyzeWaveform = useCallback(() => {
    console.log('Analyzing waveform');
    if (!canvasRef.current) {
      console.warn('Canvas ref is null');
      return { waveform: new Array(800).fill(0.5), coordinates: [] };
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 800, 400);
    const data = imageData.data;
    const waveform = [];
    const coordinates = [];

    for (let x = 0; x < 800; x++) {
      let sum = 0;
      let count = 0;
      let minY = 400;
      let maxY = 0;
      for (let y = 0; y < 400; y++) {
        const index = (y * 800 + x) * 4;
        // Check for bright green pixels (high G value, low R and B values)
        if (data[index + 1] > 200 && data[index] < 100 && data[index + 2] < 100) {
          sum += y;
          count++;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      const avgY = count > 0 ? sum / count / 400 : 0.5; // Default to 0.5 if no green pixels
      waveform.push(avgY);
      coordinates.push({ x, minY: minY === 400 ? 400 / 2 : minY, maxY: maxY === 0 ? 400 / 2 : maxY, avgY: avgY * 400 });
    }
    
    // If the waveform is empty (no bright green pixels detected), create a default flat line
    if (waveform.every(v => v === 0.5)) {
      console.log('No line detected, creating default waveform');
      return { 
        waveform: new Array(800).fill(0.5), 
        coordinates: new Array(800).fill({ minY: 400 / 2, maxY: 400 / 2, avgY: 400 / 2 })
      };
    }
    
    console.log('Waveform analysis complete', { waveform, coordinates });
    console.log('Generated waveform:', waveform);
    console.log('Generated coordinates:', coordinates);
    return { waveform, coordinates };
  }, []);

  useEffect(() => {
    return () => {
      const currentAnimationRef = animationRef.current;
      if (currentAnimationRef) {
        cancelAnimationFrame(currentAnimationRef);
      }
    };
  }, []);

  return (
    <div className="App garageband-style">
      <header className="app-header">
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>Beat This Line!</h1>
      </header>
      <div className="main-content">
        <div className="toolbar" style={{ width: COMPONENT_WIDTH }}>
          <div className="thickness-control">
            <label htmlFor="thickness" style={{ fontFamily: 'Orbitron, sans-serif' }}>Line Thickness</label>
            <input
              type="range"
              id="thickness"
              min="1"
              max="20"
              value={lineThickness}
              onChange={handleThicknessChange}
            />
            <span style={{ fontFamily: 'Orbitron, sans-serif' }}>{lineThickness}px</span>
          </div>
          <button className="toolbar-button" onClick={clearCanvas} disabled={isPlaying} style={{ fontFamily: 'Orbitron, sans-serif' }}>Clear Canvas</button>
        </div>
        <div className="canvas-container">
          <DrawingCanvas
            width={COMPONENT_WIDTH}
            height={400}
            lineThickness={lineThickness}
            onDrawingComplete={handleDrawingComplete}
          />
          <BeatVisualizer 
            beatData={beatData} 
            width={COMPONENT_WIDTH} 
            height={100} 
            currentTime={currentTime}
          />
        </div>
      </div>
      {debugInfo && <div className="debug-info" style={{ width: COMPONENT_WIDTH }}>{debugInfo}</div>}
      <button 
        className="beat-it-button" 
        onClick={playBeat} 
        disabled={isPlaying}
        style={{
          width: COMPONENT_WIDTH,
          maxWidth: '100%',
          margin: '10px auto',
          padding: '15px 0',
          fontSize: '18px',
          fontWeight: 'bold',
          fontFamily: 'Orbitron, sans-serif',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {isPlaying ? 'Playing...' : 'BEAT IT'}
      </button>
    </div>
  );
}

export default App;