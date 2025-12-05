<script>
  import { store } from '../lib/store.svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
</script>

<div class="toast-container">
  {#each store.toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      animate:flip={{ duration: 300, easing: cubicOut }}
      in:fly={{ y: 20, duration: 300, easing: cubicOut }}
      out:fly={{ y: 10, duration: 200, opacity: 0 }}
      role="alert"
    >
      <span>{toast.text}</span>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 2000;
    pointer-events: none;
    width: max-content;
    max-width: 90vw;
  }

  .toast {
    pointer-events: auto;
    background: var(--md-sys-color-inverse-surface);
    color: var(--md-sys-color-inverse-on-surface);
    padding: 12px 24px;
    border-radius: 28px;
    box-shadow: var(--md-sys-elevation-3);
    font-family: var(--md-ref-typeface-plain);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-width: 200px;
  }

  .toast-error {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }
  
  .toast-success {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
</style>