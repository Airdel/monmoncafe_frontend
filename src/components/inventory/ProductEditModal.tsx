import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { productImageSrc, resizeImage } from '../../lib/images';
import { unwrap } from '../../lib/unwrap';
import { cn } from '../../lib/cn';
import { Modal } from '../ui/Modal';

export interface EditableProduct {
  id: number;
  name: string;
  categoryId: number;
  isActive: boolean;
  imageUrl?: string | null;
  category?: { id?: number; name: string };
}

interface Category {
  id: number;
  name: string;
}

const inputClass = 'w-full px-4 py-3 bg-ink/5 border border-ink/10 rounded-xl text-ink focus:border-primary/50 focus:outline-none placeholder:text-ink/20';
const labelClass = 'text-ink/50 text-xs font-label uppercase tracking-widest block mb-2';

/** Name, POS category, visibility and photo of a product (the recipe is edited separately). */
export function ProductEditModal({ product, onClose, onSaved }: {
  product: EditableProduct;
  onClose: () => void;
  onSaved: (product: EditableProduct) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [isActive, setIsActive] = useState(product.isActive);
  // undefined = keep current photo, null = remove it, Blob = upload this one
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(productImageSrc(product.imageUrl));
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/products/categories')
      .then(res => {
        const list = unwrap<Category[]>(res);
        // Same de-duplication by name as the POS, so the chosen category is the one shown there
        setCategories(Array.from(new Map(list.map(c => [c.name, c])).values()));
      })
      .catch(err => setError(getErrorMessage(err)));
  }, []);

  // Free the local preview URL when it is replaced or the dialog closes
  useEffect(() => () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      const resized = await resizeImage(file);
      setPhoto(resized);
      setPhotoPreview(URL.createObjectURL(resized));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo leer la imagen'));
    } finally {
      setProcessing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const categoryOptions = categories.some(c => c.id === categoryId)
    ? categories
    : [...categories, { id: categoryId, name: product.category?.name ?? `Categoría ${categoryId}` }];

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      let saved = unwrap<EditableProduct>(await api.patch(`/products/${product.id}`, {
        name: name.trim(),
        categoryId,
        isActive,
      }));
      if (photo) {
        const form = new FormData();
        form.append('image', photo, 'foto.jpg');
        saved = unwrap<EditableProduct>(await api.post(`/products/${product.id}/image`, form));
      } else if (photo === null && product.imageUrl) {
        saved = unwrap<EditableProduct>(await api.delete(`/products/${product.id}/image`));
      }
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar producto" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className={labelClass}>Foto en el POS</p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary/5 border border-ink/10 shrink-0 flex items-center justify-center">
              {processing ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-headline font-bold text-2xl text-primary/30">{(name || product.name).substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" /> {photoPreview ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {photoPreview && (
                <button type="button" onClick={removePhoto} className="px-4 py-2 rounded-xl text-error/80 hover:text-error hover:bg-error/10 text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Quitar foto
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="product-name">Nombre</label>
          <input id="product-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="product-category">Categoría en el POS</label>
          <select id="product-category" value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} className={inputClass}>
            {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive(!isActive)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-ink/5 border border-ink/10 text-left"
        >
          <span className={cn('w-11 h-6 rounded-full p-0.5 transition-colors shrink-0', isActive ? 'bg-primary' : 'bg-ink/20')}>
            <span className={cn('block w-5 h-5 rounded-full bg-raised shadow transition-transform', isActive && 'translate-x-5')} />
          </span>
          <span className="min-w-0">
            <span className="block text-ink font-medium">{isActive ? 'Se vende en el POS' : 'Oculto en el POS'}</span>
            <span className="block text-ink/40 text-xs">{isActive ? 'Apágalo para dejar de venderlo sin perder su historial.' : 'Sus ventas pasadas y su receta se conservan.'}</span>
          </span>
        </button>

        {error && <p className="text-error text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving || processing || !name.trim()}
          className="w-full py-3 rounded-xl bg-cta text-on-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar
        </button>
      </div>
    </Modal>
  );
}
