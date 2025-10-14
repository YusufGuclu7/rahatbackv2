const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const cloudStorageModel = {
  create: async (data) => {
    return prisma.cloudStorage.create({
      data,
    });
  },

  findById: async (id) => {
    return prisma.cloudStorage.findUnique({
      where: { id },
    });
  },

  findByUserId: async (userId, filters = {}) => {
    const where = { userId };

    if (filters.storageType) {
      where.storageType = filters.storageType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return prisma.cloudStorage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  findDefaultByUserId: async (userId, storageType) => {
    return prisma.cloudStorage.findFirst({
      where: {
        userId,
        storageType,
        isDefault: true,
        isActive: true,
      },
    });
  },

  update: async (id, data) => {
    return prisma.cloudStorage.update({
      where: { id },
      data,
    });
  },

  delete: async (id) => {
    return prisma.cloudStorage.delete({
      where: { id },
    });
  },

  setAsDefault: async (id, userId, storageType) => {
    // First, unset all defaults for this user and storage type
    await prisma.cloudStorage.updateMany({
      where: {
        userId,
        storageType,
      },
      data: {
        isDefault: false,
      },
    });

    // Then set the specified one as default
    return prisma.cloudStorage.update({
      where: { id },
      data: {
        isDefault: true,
      },
    });
  },
};

module.exports = cloudStorageModel;
