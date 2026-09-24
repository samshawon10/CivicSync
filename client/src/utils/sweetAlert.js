import Swal from 'sweetalert2';

const theme = () => ({
  background: 'var(--surface, #ffffff)',
  color: 'var(--fg, #0f172a)',
  confirmButtonColor: 'var(--color-civic-600, #2563eb)',
  cancelButtonColor: 'var(--fg-muted, #64748b)',
  customClass: { popup: 'civicsync-swal' }
});

const base = () => ({ buttonsStyling: false, ...theme() });

export function showSuccess(title, text = '') {
  return Swal.fire({ ...base(), icon: 'success', title, text, toast: true, position: 'top-end', showConfirmButton: false, timer: 3600, timerProgressBar: true, didOpen: (element) => element.classList.add('civicsync-swal-toast') });
}

export function showInfo(title, text = '') {
  return Swal.fire({ ...base(), icon: 'info', title, text, toast: true, position: 'top-end', showConfirmButton: false, timer: 3200, timerProgressBar: true, didOpen: (element) => element.classList.add('civicsync-swal-toast') });
}

export function showWarning(title, text = '') {
  return Swal.fire({ ...base(), icon: 'warning', title, text, toast: true, position: 'top-end', showConfirmButton: false, timer: 4200, timerProgressBar: true, didOpen: (element) => element.classList.add('civicsync-swal-toast') });
}

export function showError(title, text = '') {
  return Swal.fire({ ...base(), icon: 'error', title, text, toast: true, position: 'top-end', showConfirmButton: false, timer: 5200, timerProgressBar: true, didOpen: (element) => element.classList.add('civicsync-swal-toast') });
}

export function showCriticalError(title, text = 'Please try again.') {
  return Swal.fire({ ...base(), icon: 'error', title, text, confirmButtonText: 'Reload', showCancelButton: false, allowOutsideClick: false }).then((result) => { if (result.isConfirmed) window.location.reload(); });
}

export async function confirmAction({ title, text = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, requireText = '' }) {
  const result = await Swal.fire({
    ...base(),
    icon: danger ? 'warning' : 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: cancelLabel,
    reverseButtons: true,
    focusCancel: danger,
    input: requireText ? 'text' : undefined,
    inputPlaceholder: requireText ? `Type ${requireText} to continue` : undefined,
    inputValidator: requireText ? (value) => String(value || '').trim().toLowerCase() === requireText.toLowerCase() ? undefined : `Type ${requireText} exactly to continue.` : undefined
  });
  return result.isConfirmed;
}

export default Swal;
