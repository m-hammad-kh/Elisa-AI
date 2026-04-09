import { createContext } from "react";

export const MessagesContext = createContext({
    messages: [],
    setMessages: () => {},
    selectedElement: null,
    setSelectedElement: () => {},
    chatOnly: false,
    setChatOnly: () => {}
});