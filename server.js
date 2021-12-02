// Important reading: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
// Useful links:

const http = require("http");
const crypto = require("crypto");
const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.send("Hello!");
  }
});

const WebSocketOperationCodeEnum = {
  FINAL: 0x80, // decimal 128
  CLOSE: 0x8, // decimal 8
  STRING: 0x1, // decimal 1
};

const WebSocketBytesOffset = {
  OPERATION_CODE: 0,
  PAYLOAD_LENGTH: 1,
  MASK_KEY_CLIENT: 2,
  DATA_CLIENT: 6,
};

const BitWiseComparatorAmount = {
  FOUR: 0xf, // decimal 15 - binary 1111
  SEVEN: 0x7f, // decimal 127 - binary 1111111
};

const sendClientDataFrame = (socket, data) => {
  // Check doc:
  // https://www.rfc-editor.org/rfc/rfc6455#section-11.8
  // https://www.rfc-editor.org/rfc/rfc6455#section-5.2
  // https://www.rfc-editor.org/rfc/rfc6455#section-5.6

  const payload = Buffer.from(data, "utf-8");

  // Merge all buffers resulting in some hexadecimal values with the entire data
  const frame = Buffer.concat([
    Buffer.from([
      WebSocketOperationCodeEnum.FINAL + WebSocketOperationCodeEnum.STRING,
    ]),
    Buffer.from([payload.length]),
    payload,
  ]);

  // Send data to client
  socket.write(frame, "utf-8");
};

const getValidHandShakeKey = (req) => {
  // Check doc:
  // https://www.rfc-editor.org/rfc/rfc6455#page-7
  // https://www.rfc-editor.org/rfc/rfc6455#page-24

  const GUID_FROM_DOC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  const webSocketHeader = req.headers["sec-websocket-key"];

  // We need this sha1 hash to ensure the socket handshake
  const sha1 = crypto.createHash("sha1");

  sha1.update(webSocketHeader + GUID_FROM_DOC);

  return sha1.digest("base64");
};

const writeSocketValidUpgrade = (req, socket) => {
  const acceptKey = getValidHandShakeKey(req);

  // Response based on doc: https://www.rfc-editor.org/rfc/rfc6455#section-1.2
  const responseHeaders = [
    "HTTP/1.1 101 Web Socket Protocols",
    "Upgrade: WebSocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n",
  ].join("\r\n");

  // Send correct headers to respond client
  socket.write(responseHeaders);
};

const handleClientWebSocketData = (clientBuffer) => {
  const webSocketClientOperationByte = clientBuffer.readUInt8(
    WebSocketBytesOffset.OPERATION_CODE
  );

  // & is used to ignore every bit which doesn't correspond to opcode
  // https://www.rfc-editor.org/rfc/rfc6455#section-5.2
  const opCode = webSocketClientOperationByte & BitWiseComparatorAmount.FOUR;

  if (opCode === WebSocketOperationCodeEnum.CLOSE) return null; // This null signify it's a connection termination frame

  if (opCode !== WebSocketOperationCodeEnum.STRING) return; // We just wanna string for now

  const webSocketPayloadLengthByte = clientBuffer.readUInt8(
    WebSocketBytesOffset.PAYLOAD_LENGTH
  );

  // & is used to ignore every bit which doesn't correspond to payload length
  const framePayloadLength =
    webSocketPayloadLengthByte & BitWiseComparatorAmount.SEVEN;

  const responseBuffer = new Buffer.alloc(
    clientBuffer.length - WebSocketBytesOffset.DATA_CLIENT
  );

  let frameByteIndex = WebSocketBytesOffset.DATA_CLIENT;

  // This loop is based on doc: https://www.rfc-editor.org/rfc/rfc6455#section-5.3
  for (let i = 0, j = 0; i < framePayloadLength; ++i, j = i % 4) {
    // Browser always mask the frame
    // "The masking key is a 32-bit value chosen at random by the client"
    // https://www.rfc-editor.org/rfc/rfc6455#page-30.
    // https://www.rfc-editor.org/rfc/rfc6455#section-5.3
    const frameMask = clientBuffer[WebSocketBytesOffset.MASK_KEY_CLIENT + j];

    const source = clientBuffer.readUInt8(frameByteIndex); // receive hexadecimal, return decimal

    responseBuffer.writeUInt8(source ^ frameMask, i);

    frameByteIndex++;
  }

  console.log(
    `Client websocket frame value ->${responseBuffer.toString("utf-8")}<-`
  );
};

const runWebSocket = () => {
  server.on("upgrade", (req, socket, head) => {
    writeSocketValidUpgrade(req, socket);
    sendClientDataFrame(socket, "Hey client, this is server talking!");

    socket.on("data", handleClientWebSocketData);
  });

  const port = 4000;
  server.listen(port);
  console.log(`Server running on port ${port}`);

  return server;
};

runWebSocket();
