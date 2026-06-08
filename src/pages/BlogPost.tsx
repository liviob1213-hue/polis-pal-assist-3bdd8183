import { Link, useParams, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { blogPosts } from "@/data/blogPosts";
import logo from "@/assets/logo-democrat-icon.png";

const BlogPost = () => {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="DEMOCRAT.AI" className="h-8 w-8" />
            <span className="font-bold tracking-tight">DEMOCRAT.AI</span>
          </Link>
          <Link
            to="/blog"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Todos os artigos
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{post.author}</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(post.date).toLocaleDateString("pt-BR")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.readingTime}
          </span>
        </div>

        <div className="mt-8 prose prose-sm sm:prose-base prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground max-w-none">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        <div className="mt-12 p-6 glass-card rounded-2xl text-center">
          <h3 className="text-xl font-bold">Pronto para transformar seu mandato?</h3>
          <p className="text-muted-foreground text-sm mt-2">
            Conheça a DEMOCRAT.AI, a plataforma completa para gestão política inteligente.
          </p>
          <Link
            to="/#planos"
            className="inline-block mt-4 px-6 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold"
          >
            Ver planos
          </Link>
        </div>
      </article>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DEMOCRAT.AI · <Link to="/politica-privacidade" className="hover:text-foreground">Política de Privacidade</Link>
      </footer>
    </div>
  );
};

export default BlogPost;
