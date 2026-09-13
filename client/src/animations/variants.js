export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease: 'easeOut' } }
};

export const cardReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: (index = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: Math.min(index * 0.08, 0.4), ease: 'easeOut' } })
};

export const viewportOnce = { once: true, amount: 0.16 };

