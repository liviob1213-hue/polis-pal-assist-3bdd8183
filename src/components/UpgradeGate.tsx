import { motion } from "framer-motion";
import { Lock, Check, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FEATURE_COPY,
  LockableFeature,
  upgradeWhatsAppLink,
} from "@/config/planFeatures";

interface UpgradeGateProps {
  feature: LockableFeature;
}

export function UpgradeGate({ feature }: UpgradeGateProps) {
  const copy = FEATURE_COPY[feature];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-xl px-1 py-4 sm:py-8"
    >
      <div className="glass-card rounded-2xl border border-border p-5 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary">
          <Lock className="h-6 w-6 text-primary-foreground" />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          {copy.nome} · versão completa
        </span>

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          {copy.headline}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">{copy.sub}</p>

        <ul className="mt-6 space-y-3 text-left">
          {copy.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" />
              </span>
              <span className="text-sm leading-snug">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-xl bg-secondary/60 p-4">
          <p className="text-sm text-muted-foreground">
            Você já tem a versão Lite. Por mais
          </p>
          <p className="text-3xl font-bold text-primary">{UPGRADE_PRICE_LABEL}</p>
          <p className="text-sm text-muted-foreground">
            você libera esta e todas as outras funções do sistema.
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="mt-5 h-14 w-full rounded-xl gradient-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-md)]"
        >
          <a href={upgradeWhatsAppLink(copy.nome)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-5 w-5" />
            Liberar agora no WhatsApp
          </a>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Atendimento humano · liberação no mesmo dia do pagamento
        </p>
      </div>
    </motion.section>
  );
}

export default UpgradeGate;
