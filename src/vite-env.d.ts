/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg?react" {
  import { ReactHTMLAttributes, Ref } from "react";
  const content: {
    default: React.FunctionComponent<
      ReactHTMLAttributes<SVGElement> & { ref?: Ref<SVGSVGElement> }
    >;
  };
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}
