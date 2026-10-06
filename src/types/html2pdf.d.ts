declare module 'html2pdf.js' {
  interface Worker {
    set(options: object): Worker;
    from(element: HTMLElement): Worker;
    save(): Promise<void>;
  }
  export default function html2pdf(): Worker;
}
