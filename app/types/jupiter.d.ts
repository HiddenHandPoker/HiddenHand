declare global {
  interface Window {
    Jupiter: JupiterPlugin;
  }
}

export type WidgetPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";
export type WidgetSize = "sm" | "default";
export type SwapMode = "ExactInOrOut" | "ExactIn" | "ExactOut";

export interface FormProps {
  swapMode?: SwapMode;
  initialAmount?: string;
  initialInputMint?: string;
  initialOutputMint?: string;
  fixedAmount?: boolean;
  fixedMint?: string;
  referralAccount?: string;
  referralFee?: number;
}

export interface IInit {
  localStoragePrefix?: string;
  formProps?: FormProps;
  autoConnect?: boolean;
  displayMode?: "modal" | "integrated" | "widget";
  integratedTargetId?: string;
  widgetStyle?: {
    position?: WidgetPosition;
    size?: WidgetSize;
  };
  containerStyles?: React.CSSProperties;
  containerClassName?: string;
  enableWalletPassthrough?: boolean;
  passthroughWalletContextState?: unknown;
  onRequestConnectWallet?: () => void | Promise<void>;
  onSwapError?: (info: {
    error?: unknown;
    quoteResponseMeta: unknown;
  }) => void;
  onSuccess?: (info: {
    txid: string;
    swapResult: unknown;
    quoteResponseMeta: unknown;
  }) => void;
  onFormUpdate?: (form: unknown) => void;
  onScreenUpdate?: (screen: unknown) => void;
}

export interface JupiterPlugin {
  _instance: unknown;
  init: (props: IInit) => void;
  resume: () => void;
  close: () => void;
  root: unknown;
  enableWalletPassthrough: boolean;
  onRequestConnectWallet: IInit["onRequestConnectWallet"];
  syncProps: (props: {
    passthroughWalletContextState?: unknown;
  }) => void;
  onSwapError: IInit["onSwapError"];
  onSuccess: IInit["onSuccess"];
  onFormUpdate: IInit["onFormUpdate"];
  onScreenUpdate: IInit["onScreenUpdate"];
  localStoragePrefix: string;
}

export {};
