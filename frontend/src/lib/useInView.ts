import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from "vue";

/**
 * Whether `target` has come into (or near) the viewport; once true, it stays
 * true and stops watching.
 *
 * @remarks
 * Where there's no IntersectionObserver it's true from the start, so content
 * that waits on it is never left hidden.
 */
export function useInView(target: Readonly<Ref<HTMLElement | null>>, options: { rootMargin?: string } = {}) {
  const inView = ref(typeof IntersectionObserver === "undefined");
  let observer: IntersectionObserver | undefined;

  onMounted(() => {
    if (inView.value || !target.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (inView.value || !entries.some((entry) => entry.isIntersecting)) return;
        inView.value = true;
        observer?.disconnect();
      },
      { rootMargin: options.rootMargin },
    );
    observer.observe(target.value);
  });

  onBeforeUnmount(() => observer?.disconnect());

  return readonly(inView);
}
