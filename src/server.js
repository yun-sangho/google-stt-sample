const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');

// Google Cloud
require('dotenv').config();
const speech = require('@google-cloud/speech');
let speechClient;

const app = express();
const port = process.env.PORT || 1337;
const server = require('http').createServer(app);

const io = require('socket.io')(server);

const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'ko-KR';
// const languageCode = 'en-US';

const request = {
  config: {
    encoding,
    sampleRateHertz,
    languageCode,
  },
  interimResults: true, // If you want interim results, set this to true
};

io.on('connection', function (client) {
  console.log('Client Connected to server');
  let recognizeStream = null;

  client.on('join', function () {
    client.emit('messages', 'Socket Connected to Server');
  });

  client.on('messages', function (data) {
    client.emit('broad', data);
  });

  client.on('recordingStart', function (data) {
    console.log('recording started on client');
    startRecognitionStream(this, data);
  });

  client.on('recordingStop', function () {
    console.log('recording stopped on client');
    stopRecognitionStream();
  });

  client.on('buffer', function (data) {
    if (recognizeStream !== null) {
      recognizeStream.write(data);
    }
  });

  function startRecognitionStream(client) {
    speechClient = new speech.SpeechClient();
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', console.error)
      .on('data', (data) => {
        console.log(data)
        process.stdout.write(data.results[0] && data.results[0].alternatives[0] ? `Transcription: ${data.results[0].alternatives[0].transcript}\n` : '\n\nReached transcription time limit, press Ctrl+C\n');
        client.emit('speechData', data);
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }

    if (speechClient) {
        speechClient.close()
    }

    recognizeStream = null;
    speechClient = null;
  }
});

server.listen(port, '127.0.0.1', function () {
  console.log('Server started on port:' + port);
});
