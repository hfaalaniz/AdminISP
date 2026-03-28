import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export const ConfirmDialog = ({ title, message, onConfirm, onClose, loading }: Props) => (
  <Modal title={title} onClose={onClose} size="sm">
    <p className="text-gray-600 text-sm mb-6">{message}</p>
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="danger" onClick={onConfirm} disabled={loading}>
        {loading ? 'Eliminando...' : 'Confirmar'}
      </Button>
    </div>
  </Modal>
);
