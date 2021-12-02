let webSocket;

function bootstrapWebSocket() {
  webSocket = new WebSocket("ws://localhost:4000");

  webSocket.onmessage = (socketMessageEvent) => {
    console.log("socket message", socketMessageEvent);
  };
}

function onClickSendWebSocketFrame() {
  const messageInputValue = document.querySelector("#message-input").value;

  webSocket.send(messageInputValue);
}

bootstrapWebSocket();
