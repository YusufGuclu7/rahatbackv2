const httpStatus = require('http-status');
const { cloudStorageModel } = require('../models');
const { getCloudStorageConnector } = require('../utils/cloudStorage');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create cloud storage configuration
 */
const createCloudStorage = async (userId, storageData) => {
  // If this is set as default, unset other defaults
  if (storageData.isDefault) {
    await cloudStorageModel.setAsDefault(null, userId, storageData.storageType);
  }

  const cloudStorage = await cloudStorageModel.create({
    ...storageData,
    userId,
  });

  return cloudStorage;
};

/**
 * Get cloud storage by ID
 */
const getCloudStorageById = async (id, userId) => {
  const cloudStorage = await cloudStorageModel.findById(id);
  if (!cloudStorage) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cloud storage configuration not found');
  }
  if (cloudStorage.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }
  return cloudStorage;
};

/**
 * Get all cloud storage configurations for a user
 */
const getUserCloudStorages = async (userId, filters = {}) => {
  return await cloudStorageModel.findByUserId(userId, filters);
};

/**
 * Update cloud storage configuration
 */
const updateCloudStorage = async (id, userId, updateData) => {
  const cloudStorage = await getCloudStorageById(id, userId);

  // If setting as default, unset other defaults
  if (updateData.isDefault && !cloudStorage.isDefault) {
    await cloudStorageModel.setAsDefault(id, userId, cloudStorage.storageType);
  }

  return await cloudStorageModel.update(id, updateData);
};

/**
 * Delete cloud storage configuration
 */
const deleteCloudStorage = async (id, userId) => {
  await getCloudStorageById(id, userId);
  return await cloudStorageModel.delete(id);
};

/**
 * Test cloud storage connection
 */
const testConnection = async (id, userId) => {
  const cloudStorage = await getCloudStorageById(id, userId);
  const connector = getCloudStorageConnector(cloudStorage.storageType);

  try {
    const result = await connector.testConnection(cloudStorage);
    return result;
  } catch (error) {
    logger.error(`Cloud storage test failed: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Connection test failed: ${error.message}`);
  }
};

/**
 * Set cloud storage as default
 */
const setAsDefault = async (id, userId) => {
  const cloudStorage = await getCloudStorageById(id, userId);
  return await cloudStorageModel.setAsDefault(id, userId, cloudStorage.storageType);
};

/**
 * Get default cloud storage for a user and storage type
 */
const getDefaultCloudStorage = async (userId, storageType) => {
  return await cloudStorageModel.findDefaultByUserId(userId, storageType);
};

/**
 * List files in cloud storage
 */
const listFiles = async (id, userId) => {
  const cloudStorage = await getCloudStorageById(id, userId);
  const connector = getCloudStorageConnector(cloudStorage.storageType);

  try {
    const result = await connector.listBackups(cloudStorage);
    return result;
  } catch (error) {
    logger.error(`Failed to list cloud storage files: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to list files: ${error.message}`);
  }
};

module.exports = {
  createCloudStorage,
  getCloudStorageById,
  getUserCloudStorages,
  updateCloudStorage,
  deleteCloudStorage,
  testConnection,
  setAsDefault,
  getDefaultCloudStorage,
  listFiles,
};
