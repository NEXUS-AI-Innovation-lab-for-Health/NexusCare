// Événements que le Serveur envoie aux Clients

export interface ServerToClientEvents {
  // Envoie l'ID de l'utilisateur qui vient de se connecter
  "user-joined": (socketId: string) => void;

  // Envoie la liste de tous les utilisateurs déjà connectés dans la room
  "get-existing-users": (users: string[]) => void;

  // Notifie qu'un utilisateur s'est déconnecté
  "user-left": (socketId: string) => void;

  // Relai de l'Offer SDP
  "receiving-offer": (offer: RTCSessionDescriptionInit, fromId: string) => void;

  // Relai de l'Answer SDP
  "receiving-answer": (answer: RTCSessionDescriptionInit, fromId: string) => void;

  // Relai des ICE Candidates
  "receiving-ice-candidate": (candidate: RTCIceCandidateInit, fromId: string) => void;

  // Diffuse le nom d'un participant à tous les autres
  "participant-announced-name": (socketId: string, name: string) => void;

  // Message de chat reçu en temps réel
  "receive-chat-message": (content: string, senderId: string, timestamp: Date) => void;

  // Historique des messages d'une room
  "message-history": (messages: any[]) => void;
}

// Événements que le Client envoie au Serveur
export interface ClientToServerEvents {
  // Le client rejoint une room spécifique
  "join-room": (roomId: string) => void;

  // Envoi de l'Offer SDP à un autre utilisateur spécifique
  "sending-offer": (offer: RTCSessionDescriptionInit, toId: string) => void;

  // Envoi de l'Answer SDP à l'utilisateur qui a envoyé l'offer
  "sending-answer": (answer: RTCSessionDescriptionInit, toId: string) => void;

  // Envoi des ICE Candidates à un autre utilisateur spécifique
  "sending-ice-candidate": (candidate: RTCIceCandidateInit, toId: string) => void;

  // Annonce le nom de l'utilisateur à la room
  "announce-name": (name: string, roomId: string) => void;

  // Envoie un message de chat à une room
  "send-chat-message": (content: string, roomId: string, senderId: string) => void;

  // Quitte une room explicitement
  "leave-room": (roomId: string) => void;
}