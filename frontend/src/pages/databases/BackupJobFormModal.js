import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Box,
  Alert,
  Divider,
  Typography,
} from '@mui/material';
import { Save, X } from 'lucide-react';
import Swal from 'sweetalert2';
import * as backupApi from '../../api/backup';
import * as cloudStorageApi from '../../api/cloudStorage';
import AdvancedScheduleBuilder from '../../components/backup/AdvancedScheduleBuilder';

const BackupJobFormModal = ({ open, onClose, database, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    scheduleType: 'manual',
    cronExpression: '',
    advancedScheduleConfig: null,
    storageType: 'local',
    storagePath: '/backups',
    cloudStorageId: null,
    retentionDays: 30,
    compression: true,
    backupType: 'full',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [showCronInput, setShowCronInput] = useState(false);
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);
  const [cloudStorages, setCloudStorages] = useState([]);

  useEffect(() => {
    if (open && database) {
      // Modal açıldığında default değerleri ayarla
      setFormData({
        name: `${database.name} - Backup`,
        scheduleType: 'manual',
        cronExpression: '',
        advancedScheduleConfig: null,
        storageType: 'local',
        storagePath: `/backups/${database.name.toLowerCase().replace(/\s/g, '_')}`,
        cloudStorageId: null,
        retentionDays: 30,
        compression: true,
        backupType: 'full',
        isActive: true,
      });

      // Cloud storage listesini yükle
      loadCloudStorages();
    }
  }, [open, database]);

  useEffect(() => {
    // Hem 'custom' hem 'advanced' seçildiğinde gelişmiş zamanlama göster
    setShowAdvancedSchedule(formData.scheduleType === 'custom' || formData.scheduleType === 'advanced');
    setShowCronInput(false); // Cron input'unu artık hiç gösterme
  }, [formData.scheduleType]);

  const loadCloudStorages = async () => {
    try {
      const data = await cloudStorageApi.getCloudStorages({ isActive: true });
      setCloudStorages(data);
    } catch (error) {
      console.error('Cloud storage listesi yüklenemedi:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    // Validasyon
    if (!formData.name.trim()) {
      Swal.fire('Hata', 'Job adı gerekli', 'error');
      return;
    }

    if (formData.storageType === 'local' && !formData.storagePath.trim()) {
      Swal.fire('Hata', 'Depolama yolu gerekli', 'error');
      return;
    }

    if (['s3', 'google_drive', 'ftp', 'azure'].includes(formData.storageType) && !formData.cloudStorageId) {
      Swal.fire('Hata', 'Cloud storage konfigürasyonu seçmelisiniz', 'error');
      return;
    }

    if ((formData.scheduleType === 'custom' || formData.scheduleType === 'advanced') && !formData.advancedScheduleConfig) {
      Swal.fire('Hata', 'Gelişmiş zamanlama ayarları gerekli', 'error');
      return;
    }

    setLoading(true);
    try {
      // Eğer custom seçildiyse, backend'e "advanced" olarak gönder
      const scheduleType = formData.scheduleType === 'custom' ? 'advanced' : formData.scheduleType;

      const payload = {
        databaseId: database.id,
        ...formData,
        scheduleType,
        retentionDays: parseInt(formData.retentionDays),
        // If advanced schedule, send config as JSON string
        advancedScheduleConfig:
          (formData.scheduleType === 'advanced' || formData.scheduleType === 'custom') && formData.advancedScheduleConfig
            ? JSON.stringify(formData.advancedScheduleConfig)
            : null,
      };

      await backupApi.createBackupJob(payload);

      Swal.fire('Başarılı', 'Backup job başarıyla oluşturuldu', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Backup job oluşturulurken hata oluştu';
      Swal.fire('Hata', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getCronHint = (type) => {
    const hints = {
      hourly: 'Her saat başı çalışır',
      daily: 'Her gün saat 02:00\'da çalışır',
      weekly: 'Her Pazar saat 03:00\'da çalışır',
      monthly: 'Her ayın 1\'inde saat 04:00\'da çalışır',
      manual: 'Sadece manuel çalıştırıldığında yedek alır',
      custom: 'Detaylı zamanlama seçenekleri ile özelleştirin - Sıklık, çalışma saatleri, günler ve daha fazlası',
    };
    return hints[type] || '';
  };

  if (!database) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Backup Job Oluştur</Typography>
          <Typography variant="body2" color="text.secondary">
            {database.name} ({database.type})
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Job Adı */}
          <TextField
            label="Job Adı"
            fullWidth
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Örn: Günlük Yedek"
            required
          />

          {/* Zamanlama */}
          <Box>
            <FormControl fullWidth>
              <InputLabel>Zamanlama Tipi</InputLabel>
              <Select
                value={formData.scheduleType}
                onChange={(e) => handleChange('scheduleType', e.target.value)}
                label="Zamanlama Tipi"
              >
                <MenuItem value="manual">Manuel</MenuItem>
                <MenuItem value="hourly">Saatlik</MenuItem>
                <MenuItem value="daily">Günlük</MenuItem>
                <MenuItem value="weekly">Haftalık</MenuItem>
                <MenuItem value="monthly">Aylık</MenuItem>
                <MenuItem value="custom">Özel (Gelişmiş Zamanlama)</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 1 }}>
              {getCronHint(formData.scheduleType)}
            </Alert>
          </Box>

          {/* Advanced Schedule Builder (sadece custom seçilirse) */}
          {showAdvancedSchedule && (
            <AdvancedScheduleBuilder
              value={formData.advancedScheduleConfig}
              onChange={(config) => handleChange('advancedScheduleConfig', config)}
            />
          )}

          <Divider />

          {/* Depolama Ayarları */}
          <Typography variant="subtitle1" fontWeight="bold">
            Depolama Ayarları
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Depolama Tipi</InputLabel>
            <Select
              value={formData.storageType}
              onChange={(e) => handleChange('storageType', e.target.value)}
              label="Depolama Tipi"
            >
              <MenuItem value="local">Yerel (Sunucu)</MenuItem>
              <MenuItem value="s3">AWS S3</MenuItem>
              <MenuItem value="google_drive">Google Drive</MenuItem>
              <MenuItem value="ftp">FTP</MenuItem>
              <MenuItem value="azure">Azure Blob</MenuItem>
            </Select>
          </FormControl>

          {/* Cloud Storage Config Dropdown (S3, Google Drive, FTP, Azure için) */}
          {['s3', 'google_drive', 'ftp', 'azure'].includes(formData.storageType) && (
            <FormControl fullWidth>
              <InputLabel>Cloud Storage Konfigürasyonu</InputLabel>
              <Select
                value={formData.cloudStorageId || ''}
                onChange={(e) => handleChange('cloudStorageId', e.target.value)}
                label="Cloud Storage Konfigürasyonu"
                required
              >
                {cloudStorages
                  .filter((cs) => cs.storageType === formData.storageType)
                  .map((cs) => (
                    <MenuItem key={cs.id} value={cs.id}>
                      {cs.name} {cs.isDefault && '(Varsayılan)'}
                    </MenuItem>
                  ))}
                {cloudStorages.filter((cs) => cs.storageType === formData.storageType).length === 0 && (
                  <MenuItem disabled>Bu depolama tipi için konfigürasyon bulunamadı</MenuItem>
                )}
              </Select>
              {cloudStorages.filter((cs) => cs.storageType === formData.storageType).length === 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Önce Cloud Storage sayfasından bir {formData.storageType === 'google_drive' ? 'Google Drive' : formData.storageType.toUpperCase()} konfigürasyonu oluşturmalısınız.
                </Alert>
              )}
            </FormControl>
          )}

          {/* Depolama Yolu (sadece local için) */}
          {formData.storageType === 'local' && (
            <TextField
              label="Depolama Yolu"
              fullWidth
              value={formData.storagePath}
              onChange={(e) => handleChange('storagePath', e.target.value)}
              placeholder="/backups/database_name"
              helperText="Yedek dosyalarının kaydedileceği yol"
              required
            />
          )}

          <TextField
            label="Saklama Süresi (Gün)"
            type="number"
            fullWidth
            value={formData.retentionDays}
            onChange={(e) => handleChange('retentionDays', e.target.value)}
            inputProps={{ min: 1, max: 365 }}
            helperText="Yedekler kaç gün saklanacak?"
          />

          <Divider />

          {/* Backup Type */}
          <Typography variant="subtitle1" fontWeight="bold">
            Yedekleme Tipi
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Yedekleme Tipi</InputLabel>
            <Select
              value={formData.backupType}
              onChange={(e) => handleChange('backupType', e.target.value)}
              label="Yedekleme Tipi"
            >
              <MenuItem value="full">Full Backup (Tam Yedekleme)</MenuItem>
              <MenuItem value="incremental">Incremental Backup (Artırımlı)</MenuItem>
              <MenuItem value="differential">Differential Backup (Fark Yedekleme)</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ mt: 1 }}>
            {formData.backupType === 'full' && 'Tüm veritabanı yedeklenir. En güvenli ama en fazla yer kaplar.'}
            {formData.backupType === 'incremental' && 'Sadece son yedekten sonra değişen veriler yedeklenir. Daha hızlı ve az yer kaplar.'}
            {formData.backupType === 'differential' && 'Son tam yedekten sonra değişen tüm veriler yedeklenir.'}
          </Alert>

          <Divider />

          {/* Switch'ler */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.compression}
                  onChange={(e) => handleChange('compression', e.target.checked)}
                />
              }
              label="Sıkıştırma (Gzip)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                />
              }
              label="Job'u Aktif Başlat"
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} startIcon={<X size={18} />} disabled={loading}>
          İptal
        </Button>
        <Button variant="contained" onClick={handleSubmit} startIcon={<Save size={18} />} disabled={loading}>
          {loading ? 'Oluşturuluyor...' : 'Oluştur'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BackupJobFormModal;
