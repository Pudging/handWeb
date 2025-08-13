declare module 'react-hot-toast' {
  export const toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    loading: (message: string) => void;
    dismiss: () => void;
  };
  
  export const Toaster: React.ComponentType<any>;
}
