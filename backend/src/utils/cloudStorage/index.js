const s3Connector = require('./s3.connector');
const googleDriveConnector = require('./googleDrive.connector');

/**
 * Get cloud storage connector based on storage type
 */
const getCloudStorageConnector = (storageType) => {
  const connectors = {
    s3: s3Connector,
    google_drive: googleDriveConnector,
  };

  const connector = connectors[storageType];
  if (!connector) {
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  return connector;
};

module.exports = {
  getCloudStorageConnector,
  s3Connector,
  googleDriveConnector,
};
