import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock, ArrowLeft } from "lucide-react";
import { blogPosts } from "@/data/blogPosts";
import logo from "@/assets/logo-democrat-icon.png";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="DEMOCRAT.AI" className="h-8 w-8" />
            <span className="font-bold tracking-tight">DEMOCRAT.AI</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground hidden sm:inline">Início</Link>
            <Link to="/blog" className="text-primary font-medium">Blog</Link>
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-10 sm:py-16 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Voltar para a página inicial
        </Link>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          Blog <span className="text-primary">DEMOCRAT.AI</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Conteúdo estratégico para políticos, assessores e gestores de mandato que querem
          profissionalizar sua atuação.
        </p>
      </section>

      <main className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post, idx) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="group glass-card rounded-2xl overflow-hidden hover:shadow-[var(--shadow-lg)] transition-all"
            >
              <Link to={`/blog/${post.slug}`} className="block">
                <div className="h-40 bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground p-6">
                  <span className="text-lg font-bold text-center leading-tight line-clamp-3">
                    {post.title}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className="font-semibold text-lg leading-snug group-hover:text-primary transition">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{post.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readingTime}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DEMOCRAT.AI · <Link to="/politica-privacidade" className="hover:text-foreground">Política de Privacidade</Link>
      </footer>
    </div>
  );
};

export default Blog;
