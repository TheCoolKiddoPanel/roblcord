const socket = io();
let localStream;
let peers = {};
let roomId;
let isMuted = false;

const roomTitle = document.getElementById("roomTitle");
const muteBtn = document.getElementById("muteBtn");

document.getElementById("joinBtn").onclick = async () => {
  roomId = document.getElementById("roomInput").value;
  if (!roomId) return alert("Napíš názov miestnosti!");

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  roomTitle.textContent = `Miestnosť: ${roomId}`;

  socket.emit("join-room", roomId);

  socket.on("user-connected", (id) => {
    createOffer(id);
  });

  socket.on("offer", async (data) => {
    const pc = createPeerConnection(data.from);
    peers[data.from] = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: data.from, sdp: answer });
  });

  socket.on("answer", async (data) => {
    await peers[data.from].setRemoteDescription(new RTCSessionDescription(data.sdp));
  });

  socket.on("ice-candidate", (data) => {
    peers[data.from]?.addIceCandidate(new RTCIceCandidate(data.candidate));
  });

  socket.on("user-disconnected", (id) => {
    if (peers[id]) peers[id].close();
    delete peers[id];
    const audioEl = document.getElementById(id);
    if (audioEl) audioEl.remove();
  });
};

muteBtn.onclick = () => {
  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
};

function createPeerConnection(id) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    let audio = document.getElementById(id);
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = id;
      audio.autoplay = true;
      audio.controls = true;
      document.getElementById("peers").appendChild(audio);
    }
    audio.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { to: id, candidate: event.candidate });
    }
  };

  return pc;
}

async function createOffer(id) {
  const pc = createPeerConnection(id);
  peers[id] = pc;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { to: id, sdp: offer });
}
