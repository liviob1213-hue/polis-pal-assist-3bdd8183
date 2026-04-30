import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Phone, Mail, User, Lock, ArrowRight, CheckCircle } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

const SUPABASE_FUNCTIONS_URL = "https://aecwbjydyoxkonqbkfft.supabase.co/functions/v1";

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 9) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatPhoneForUazapi(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 13 && digits[4] === "9") {
    digits = digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

export default function Cadastro() {
  const [step, setStep] = useState<"form" | "verify">("form");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const role = "politico" as const;
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formattedPhone = formatPhoneForUazapi(telefone);

  const handleSendCode = async () => {
    if (!nome.trim() || !email.trim() || !senha || !confirmarSenha || !telefone.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (senha !== confirmarSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (senha.length < 6) {
      toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefone: formattedPhone }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar código");

      toast({ title: "Código enviado!", description: "Verifique seu WhatsApp." });
      setStep("verify");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim() || code.length !== 6) {
      toast({ title: "Digite o código de 6 dígitos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: formattedPhone,
            code,
            nome,
            email,
            password: senha,
            role,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na verificação");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (signInErr) throw new Error(signInErr.message);

      toast({ title: "Cadastro realizado!", description: `Bem-vindo ao DEMOCRAT.AI!` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--sidebar-background))] to-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src={logoDemocrat} alt="Democrat.AI" className="h-20 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "form" ? "Criar Conta" : "Verificar WhatsApp"}
          </CardTitle>
          <CardDescription>
            {step === "form"
              ? "Preencha seus dados para acessar o sistema"
              : `Digite o código enviado para ${formatPhoneDisplay(telefone.replace(/\D/g, ""))}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "form" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="nome" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} className="pl-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="telefone" placeholder="(31) 99999-9999" value={formatPhoneDisplay(telefone.replace(/\D/g, ""))} onChange={(e) => setTelefone(e.target.value)} className="pl-10" maxLength={15} />
                </div>
                {telefone.replace(/\D/g, "").length >= 10 && (
                  <p className="text-xs text-muted-foreground">
                    Formato Uazapi: <span className="font-mono text-primary">{formattedPhone}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="senha" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} className="pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="confirmar-senha" type={showConfirmPassword ? "text" : "password"} placeholder="Repita a senha" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} className="pl-10 pr-10" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmarSenha && senha !== confirmarSenha && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>

              <Button onClick={handleSendCode} disabled={loading} className="w-full" size="lg">
                {loading ? "Enviando..." : "Enviar código de verificação"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">Fazer login</Link>
              </p>
              <p className="text-center text-xs text-muted-foreground">
                É assessor?{" "}
                <Link to="/cadastro-assessor" className="text-primary hover:underline">Cadastrar como assessor</Link>
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificação</Label>
                <Input id="code" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="text-center text-2xl tracking-[0.5em] font-mono" maxLength={6} />
              </div>
              <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full" size="lg">
                {loading ? "Verificando..." : "Verificar e criar conta"}
                <CheckCircle className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex justify-between">
                <button onClick={() => setStep("form")} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</button>
                <button onClick={handleSendCode} disabled={loading} className="text-sm text-primary hover:underline">Reenviar código</button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
