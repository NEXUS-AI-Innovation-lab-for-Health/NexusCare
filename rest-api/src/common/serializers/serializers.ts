/**
 * Serialization layer to transform Prisma output into clean API shapes.
 * Maps Prisma relations (include) into flat nested API contracts.
 */

export function serializeProfession(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profession: user.profession ? serializeProfession(user.profession) : user.professionId,
    isAdmin: user.isAdmin,
    password: user.password,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeMessage(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    content: m.content,
    sender: m.senderId,
    room: m.room,
    createdAt: m.createdAt,
  };
}

export function serializePatientRecord(pr: any) {
  if (!pr) return null;
  const { id, profession, data, createdAt, updatedAt } = pr;
  return {
    id,
    profession,
    ...(typeof data === 'object' && data !== null ? data : {}),
    createdAt,
    updatedAt,
  };
}

export function serializeMeetingParticipant(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    user: p.user ? serializeUser(p.user) : p.userId,
    profession: p.profession ? serializeProfession(p.profession) : p.professionId,
    isVisible: p.isVisible,
    showProfession: p.showProfession,
    formFilled: p.formFilled,
    patientRecord: p.patientRecord
      ? serializePatientRecord(p.patientRecord)
      : p.patientRecordId ?? undefined,
    filledAt: p.filledAt,
    joinedAt: p.joinedAt,
    leftAt: p.leftAt,
  };
}

export function serializeMeeting(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    roomId: m.roomId,
    subject: m.subject,
    description: m.description,
    time: m.time,
    patientFirstName: m.patientFirstName,
    patientLastName: m.patientLastName,
    participants: (m.participants ?? []).map(serializeMeetingParticipant),
    roomAdmin: m.roomAdmin ? serializeUser(m.roomAdmin) : m.roomAdminId,
    status: m.status,
    scheduledDate: m.scheduledDate,
    startedAt: m.startedAt,
    duration: m.duration,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
