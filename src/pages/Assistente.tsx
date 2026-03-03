import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Olá! Sou seu Assistente Legislativo Especialista. Posso ajudar a redigir Projetos de Lei, discursos, indicações, requerimentos ou analisar documentos. Sobre o que gostaria de trabalhar hoje?",
  },
];

const mockResponses = [
  "Entendido! Vou preparar um rascunho de Projeto de Lei com base na sua solicitação. O texto seguirá o formato padrão da Câmara Municipal, incluindo ementa, justificativa e articulado.\n\n**Estrutura sugerida:**\n1. Ementa\n2. Considerandos\n3. Articulado (Art. 1º ao Art. X)\n4. Justificativa\n\nDeseja que eu prossiga com algum tema específico?",
  "Com base nas demandas mais recorrentes do gabinete, sugiro os seguintes temas para discurso:\n\n- **Saúde**: Ampliação do horário de funcionamento das UBS\n- **Infraestrutura**: Programa de recapeamento asfáltico\n- **Educação**: Implementação de creches noturnas\n\nQual tema gostaria de desenvolver?",
  "Aqui está o modelo de requerimento:\n\n---\n**REQUERIMENTO Nº ___/2026**\n\nSenhor Presidente,\n\nRequeiro a Vossa Excelência, ouvido o Plenário, que seja encaminhado ao Poder Executivo Municipal pedido de informações sobre...\n\n---\n\nDeseja personalizar este modelo?",
];

const Assistente = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: response }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Assistente Legislativo</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">IA especializada em redação parlamentar e jurídica.</p>
      </div>

      <Card className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">IA Online — Modelo Legislativo v2.0</span>
        </div>

        <ScrollArea className="flex-1 p-5" ref={scrollRef}>
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-accent-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
            {isTyping && (
              <div className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 max-w-3xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua ideia para lei, discurso ou ofício..."
              className="flex-1 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20"
              disabled={isTyping}
            />
            <Button type="submit" size="icon" className="gradient-primary text-primary-foreground shrink-0" disabled={isTyping || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
};

export default Assistente;
