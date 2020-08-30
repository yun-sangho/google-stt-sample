import io from "socket.io-client";
import RecrodRTC, { StereoAudioRecorder } from "recordrtc";
import ss from "socket.io-stream";

let audioRecrder;

const socket = io.connect("http://localhost:1337");

socket.on("connect", function () {
  socket.emit("join", "Server Connected to Client");
});

socket.on("messages", function (data) {
  console.log(data);
});

socket.on("result", (data) => {
  console.log(data.results[0].alternatives[0].transcript);
});

const paths = document.getElementsByTagName("path");
const visualizer = document.getElementById("visualizer");
const mask = visualizer.getElementById("mask");
const audioInputSelect = document.querySelector("select#audioSource");
const startButton = document.getElementById("startRecButton");
const stopButton = document.getElementById("stopRecButton");

const AUIDO_CONTEXT = new AudioContext();
let AUDIO_STREAM;
let AUDIO_MEDIA;
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
      const adjustedLength =
        Math.floor(frequencyArray[i]) - (Math.floor(frequencyArray[i]) % 5);
      paths[i].setAttribute("d", "M " + i + ",255 l 0,-" + adjustedLength);
    }
  };

  doDraw();
};

const handleDevices = (deviceInfos) => {
  let value = audioInputSelect.value;

  deviceInfos = deviceInfos.filter((d) => d.kind === "audioinput");

  audioInputSelect.innerHTML = "";

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    option.text =
      deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
    audioInputSelect.appendChild(option);
  }

  if (!value) {
    value = audioInputSelect[0].value;
  }

  audioInputSelect.value = value;
};

const handleStream = (stream) => {
  AUDIO_STREAM = stream;
  AUIDO_CONTEXT.resume();
  AUDIO_MEDIA = AUIDO_CONTEXT.createMediaStreamSource(AUDIO_STREAM);

  audioRecrder = RecrodRTC(stream, {
    type: "audio",
    mimeType: "audio/webm",
    sampleRate: 44100,
    desiredSampRate: 16000,
    recorderType: StereoAudioRecorder,
    numberOfAudioChannels: 1,
    timeSlice: 3000,
    ondataavailable: function (blob) {
      const audioStream = ss.createStream();

      ss(socket).emit("stream-media", audioStream, {
        name: "voice.wav",
        size: blob.size,
        languageCode: "ko-KR",
      });

      ss.createBlobReadStream(blob).pipe(audioStream);
    },
  });

  audioRecrder.startRecording();
  runVisualizer();
};

const handleError = (e) => {
  console.log(e);
};

function start() {
  console.log("[Recroding] starts");
  socket.emit("recordingStart", "");

  if (AUDIO_STREAM) {
    AUDIO_STREAM.getTracks().forEach((track) => {
      track.stop();
    });
  }

  IS_RECORDING = true;
  startButton.disabled = true;
  stopButton.disabled = false;

  const audioSource = audioInputSelect.value;
  const constraints = {
    audio: { deviceId: audioSource ? { exact: audioSource } : "defualt" },
  };
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(handleStream)
    .catch(handleError);
}

const stop = () => {
  console.log("[Recroding] stops");
  socket.emit("recordingStop", "");

  if (AUDIO_STREAM) {
    AUDIO_STREAM.getTracks().forEach((track) => {
      track.stop();
    });
    audioRecrder.stopRecording();
  }

  IS_RECORDING = false;
  startButton.disabled = false;
  stopButton.disabled = true;
};

navigator.mediaDevices
  .enumerateDevices()
  .then(handleDevices)
  .catch(handleError);

startButton.addEventListener("click", start);
stopButton.addEventListener("click", stop);

audioInputSelect.addEventListener("change", () => {
  navigator.mediaDevices
    .enumerateDevices()
    .then(handleDevices)
    .catch(handleError);

  if (IS_RECORDING) {
    stop();
    start();
  }
});
