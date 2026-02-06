import { prisma } from "../../lib/prisma";

export const chatRepository = {
  getSessionScoped: (organizationId: string, sessionId: string) =>
    prisma.session.findFirst({
      where: {
        id: sessionId,
        deletedAt: null,
        website: { organizationId }
      },
      include: { website: true }
    }),
  assignSession: (sessionId: string, agentId: string) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { assignedTo: agentId }
    }),
  upsertTag: (websiteId: string, name: string) =>
    prisma.tag.upsert({
      where: { websiteId_name: { websiteId, name } },
      update: {},
      create: { websiteId, name }
    }),
  addTagToSession: (sessionId: string, tagId: string) =>
    prisma.sessionTag.upsert({
      where: { sessionId_tagId: { sessionId, tagId } },
      update: {},
      create: { sessionId, tagId }
    })
};
