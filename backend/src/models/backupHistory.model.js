const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const backupHistoryModel = {
  create: async (data) => {
    return prisma.backupHistory.create({
      data,
      include: {
        database: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        backupJob: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  findById: async (id) => {
    return prisma.backupHistory.findUnique({
      where: { id },
      include: {
        database: true,
        backupJob: true,
      },
    });
  },

  findByJobId: async (backupJobId, limit = 50) => {
    return prisma.backupHistory.findMany({
      where: { backupJobId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  },

  findByDatabaseId: async (databaseId, limit = 50) => {
    return prisma.backupHistory.findMany({
      where: { databaseId },
      include: {
        backupJob: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  },

  findByUserId: async (userId, filters = {}) => {
    const where = {
      database: {
        userId,
      },
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.databaseId) {
      where.databaseId = filters.databaseId;
    }

    if (filters.backupJobId) {
      where.backupJobId = filters.backupJobId;
    }

    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      prisma.backupHistory.findMany({
        where,
        include: {
          database: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          backupJob: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.backupHistory.count({ where }),
    ]);

    return {
      results,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  },

  update: async (id, data) => {
    return prisma.backupHistory.update({
      where: { id },
      data,
    });
  },

  delete: async (id) => {
    return prisma.backupHistory.delete({
      where: { id },
    });
  },

  updateStatus: async (id, status, errorMessage = null) => {
    return prisma.backupHistory.update({
      where: { id },
      data: {
        status,
        errorMessage,
        completedAt: new Date(),
      },
    });
  },

  getStats: async (userId) => {
    const [total, successful, failed, totalSize] = await Promise.all([
      prisma.backupHistory.count({
        where: { database: { userId } },
      }),
      prisma.backupHistory.count({
        where: {
          database: { userId },
          status: 'success',
        },
      }),
      prisma.backupHistory.count({
        where: {
          database: { userId },
          status: 'failed',
        },
      }),
      prisma.backupHistory.aggregate({
        where: {
          database: { userId },
          status: 'success',
        },
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    return {
      total,
      successful,
      failed,
      running: total - successful - failed,
      totalSize: totalSize._sum.fileSize || 0,
    };
  },
};

module.exports = backupHistoryModel;
