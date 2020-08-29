const express = require('express');

require('dotenv').config();
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

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
  interimResults: true,
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

  client.on('recordingStart', function () {
    console.log('recording started on client');
    startRecognitionStream(this);
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
    console.log(speechClient);
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', (e) => {
        console.log('google error', e)
      })
      .on('data', (data) => {
        process.stdout.write(data.results[0] && data.results[0].alternatives[0] ? `Transcription: ${data.results[0].alternatives[0].transcript}\n` : '\n\nReached transcription time limit, press Ctrl+C\n');
        client.emit('speechData', data);
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }
});

server.listen(port, '127.0.0.1', function () {
  console.log('Server started on port:' + port);
});

process.on('beforeExit', () => {
    console.log('closing client');
    io.close();
    speechClient.close();
})

process.on('exit', () => {
    io.close();
    speechClient.close();
});