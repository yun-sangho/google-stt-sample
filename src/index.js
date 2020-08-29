import io from 'socket.io-client';
const socket = io.connect('http://localhost:1337');

socket.on('connect', function () {
	socket.emit('join', 'Server Connected to Client');
});

socket.on('messages', function (data) {
	console.log(data);
});

const paths = document.getElementsByTagName("path");
const visualizer = document.getElementById("visualizer");
const mask = visualizer.getElementById("mask");
const audioInputSelect = document.querySelector('select#audioSource');
const startButton = document.getElementById("startRecButton");
const stopButton = document.getElementById("stopRecButton");

const AUIDO_CONTEXT = new AudioContext();
let AUDIO_STREAM;
let AUDIO_MEDIA;
let AUDIO_PROCESSOR;
let IS_RECORDING = false;

const runVisualizer = () => {
  const analyser = AUIDO_CONTEXT.createAnalyser();
  AUDIO_MEDIA.connect(analyser);
  analyser.fftSize = 1024;

  const frequencyArray = new Uint8Array(analyser.frequencyBinCount);
  visualizer.setAttribute("viewBox", "0 0 255 255");

  for (let i = 0; i < 255; i++) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke-dasharray", "4,1");
    mask.appendChild(path);
  }

  const doDraw = () => {
    requestAnimationFrame(doDraw);
    analyser.getByteFrequencyData(frequencyArray);

    for (let i = 0; i < 255; i++) {
      const adjustedLength = Math.floor(frequencyArray[i]) - (Math.floor(frequencyArray[i]) % 5);
      paths[i].setAttribute("d", "M " + i + ",255 l 0,-" + adjustedLength);
    }
  };

  doDraw();
};

const handleDevices = (deviceInfos) => {
  let value = audioInputSelect.value

  deviceInfos = deviceInfos.filter((d) => d.kind === 'audioinput');

  audioInputSelect.innerHTML = '';

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
    audioInputSelect.appendChild(option);
  }

  if (!value) {
    value = audioInputSelect[0].value;
  }

  audioInputSelect.value = value;
}

const handleAudio = (bufferData) => {
  const buffer = downsampleBuffer(bufferData, 44100, 16000)
  socket.emit('buffer', buffer);
}

const handleStream = (stream) => {
  AUDIO_STREAM = stream

  AUDIO_PROCESSOR = AUIDO_CONTEXT.createScriptProcessor(2048, 1, 1);
  AUDIO_PROCESSOR.connect(AUIDO_CONTEXT.destination);
  AUIDO_CONTEXT.resume();

  AUDIO_MEDIA = AUIDO_CONTEXT.createMediaStreamSource(AUDIO_STREAM);
  AUDIO_MEDIA.connect(AUDIO_PROCESSOR);

  AUDIO_PROCESSOR.onaudioprocess = function (e) {
    const buffer = e.inputBuffer.getChannelData(0);
    handleAudio(buffer)
  };

  runVisualizer();
}

const handleError = (e) => {
  console.log(e)
}

function start() {
  console.log('[Recroding] starts')
  socket.emit('recordingStart', '');

  if (AUDIO_STREAM) {
    AUDIO_STREAM.getTracks().forEach(track => {
      track.stop();
    });
  }

  IS_RECORDING = true;
  startButton.disabled = true;
	stopButton.disabled = false;
  
  const audioSource = audioInputSelect.value;
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : 'defualt'},
  };
  navigator.mediaDevices.getUserMedia(constraints).then(handleStream).catch(handleError);
}

const stop = () => {
  console.log('[Recroding] stops')
  socket.emit('recordingStop', '');

  if (AUDIO_STREAM) {
    AUDIO_STREAM.getTracks().forEach(track => {
      track.stop();
    });
  }

  AUDIO_MEDIA.disconnect(AUDIO_PROCESSOR)
  AUDIO_PROCESSOR.disconnect(AUIDO_CONTEXT)

  IS_RECORDING = false;
  startButton.disabled = false;
  stopButton.disabled = true;
}

navigator.mediaDevices.enumerateDevices().then(handleDevices).catch(handleError);

startButton.addEventListener('click', start)
stopButton.addEventListener('click', stop)

audioInputSelect.addEventListener('change', () => {
  navigator.mediaDevices.enumerateDevices().then(handleDevices).catch(handleError);

  if (IS_RECORDING) {
    stop()
    start()
  }
});


function downsampleBuffer(buffer, sampleRate, outSampleRate) {
	if (outSampleRate === sampleRate) {
		return buffer;
  }
  
	if (outSampleRate > sampleRate) {
		throw "downsampling rate show be smaller than original sample rate";
  }
  
	const sampleRateRatio = sampleRate / outSampleRate;
	const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  
	let offsetResult = 0;
  let offsetBuffer = 0;
  
	while (offsetResult < result.length) {
		let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		let accum = 0, count = 0;
		for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i];
			count++;
		}

		result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
  }
  
	return result.buffer;
}