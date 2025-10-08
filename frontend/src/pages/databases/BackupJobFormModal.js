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

const BackupJobFormModal = ({ open, onClose, database, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    scheduleType: 'manual',
    cronExpression: '',
    storageType: 'local',
    storagePath: '/backups',
    retentionDays: 30,
    compression: true,
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [showCronInput, setShowCronInput] = useState(false);

  useEffect(() => {
    if (open && database) {
      // Modal açıldığında default değerleri ayarla
      setFormData({
        name: `${database.name} - Backup`,
        scheduleType: 'manual',
        cronExpression: '',
        storageType: 'local',
        storagePath: `/backups/${database.name.toLowerCase().replace(/\s/g, '_')}`,
        retentionDays: 30,
        compression: true,
        isActive: true,
      });
    }
  }, [open, database]);

  useEffect(() => {
    setShowCronInput(formData.scheduleType === 'custom');
  }, [formData.scheduleType]);

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

    if (!formData.storagePath.trim()) {
      Swal.fire('Hata', 'Depolama yolu gerekli', 'error');
      return;
    }

    if (formData.scheduleType === 'custom' && !formData.cronExpression.trim()) {
      Swal.fire('Hata', 'Cron ifadesi gerekli', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        databaseId: database.id,
        ...formData,
        retentionDays: parseInt(formData.retentionDays),
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
      custom: 'Özel cron ifadesi belirtin (örn: 0 2 * * *)',
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
                <MenuItem value="custom">Özel (Cron)</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 1 }}>
              {getCronHint(formData.scheduleType)}
            </Alert>
          </Box>

          {/* Cron İfadesi (sadece custom seçilirse) */}
          {showCronInput && (
            <TextField
              label="Cron İfadesi"
              fullWidth
              value={formData.cronExpression}
              onChange={(e) => handleChange('cronExpression', e.target.value)}
              placeholder="0 2 * * *"
              helperText="Format: dakika saat gün ay haftanın_günü"
              required
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
              <MenuItem value="ftp">FTP</MenuItem>
              <MenuItem value="azure">Azure Blob</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Depolama Yolu"
            fullWidth
            value={formData.storagePath}
            onChange={(e) => handleChange('storagePath', e.target.value)}
            placeholder="/backups/database_name"
            helperText="Yedek dosyalarının kaydedileceği yol"
            required
          />

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
