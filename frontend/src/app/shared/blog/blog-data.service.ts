import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { BlogArticleResponse } from '../../core/types/api.types';
import { RealStateApiService } from '../../core/services/real-state-api.service';
import { BlogArticle, BlogCategory } from './blog.types';

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'market-growth-caba-2024',
    slug: 'zonas-en-crecimiento-en-caba-para-invertir-en-2024',
    title: 'Zonas en crecimiento en CABA para invertir en 2024',
    excerpt: 'Descubri los barrios con mayor proyeccion y por que son una buena oportunidad.',
    category: 'COMPRA',
    coverImage:
      'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-24T12:00:00.000Z',
    readingMinutes: 5,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Busco departamentos para comprar en zonas con potencial de crecimiento en CABA.',
    content: [
      {
        body:
          'La Ciudad de Buenos Aires sigue siendo uno de los mercados inmobiliarios mas activos de la region. En este articulo analizamos barrios con mayor proyeccion de crecimiento y por que pueden ser una oportunidad de inversion.',
      },
      {
        heading: '1. Palermo',
        body:
          'Palermo mantiene liquidez alta, demanda constante y una oferta diversa. Es una zona competitiva, pero sigue siendo referencia para unidades chicas y alquiler temporario.',
      },
      {
        heading: '2. Caballito',
        body:
          'Caballito combina conectividad, servicios y una demanda familiar estable. Para perfiles conservadores puede funcionar como punto medio entre precio, ubicacion y profundidad de mercado.',
      },
      {
        heading: '3. Villa Crespo',
        body:
          'Villa Crespo conserva valores mas razonables que Palermo y buena cercania a polos gastronomicos y comerciales. Es una zona interesante para buscar ticket de entrada mas eficiente.',
      },
    ],
  },
  {
    id: 'rental-price-check',
    slug: 'como-saber-si-estas-pagando-un-alquiler-caro',
    title: 'Como saber si estas pagando un alquiler caro',
    excerpt: 'Claves para analizar el precio y tomar mejores decisiones antes de renovar.',
    category: 'TIPS',
    coverImage:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-18T12:00:00.000Z',
    readingMinutes: 4,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Quiero comparar alquileres similares en mi zona para saber si el precio esta bien.',
    content: [
      {
        body:
          'Para entender si un alquiler esta caro no alcanza con mirar un solo aviso. Conviene comparar unidades equivalentes por zona, ambientes, estado, expensas y amenities.',
      },
      {
        heading: 'Compara contra propiedades equivalentes',
        body:
          'La comparacion debe hacerse con unidades similares. Un dos ambientes reciclado con balcon no deberia compararse contra uno interno sin luz natural.',
      },
      {
        heading: 'Mira expensas y costo total',
        body:
          'El precio mensual real incluye expensas y costos recurrentes. Un alquiler menor puede terminar siendo mas caro si las expensas son altas o variables.',
      },
    ],
  },
  {
    id: 'rentability-by-neighborhood',
    slug: 'rentabilidad-por-barrio-donde-conviene-invertir-hoy',
    title: 'Rentabilidad por barrio: donde conviene invertir hoy',
    excerpt: 'Analizamos los barrios con mejores retornos en alquiler.',
    category: 'INVERSION',
    coverImage:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-10T12:00:00.000Z',
    readingMinutes: 6,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Busco propiedades para invertir con buena rentabilidad por alquiler.',
    content: [
      {
        body:
          'La rentabilidad depende del precio de compra, el alquiler esperado, los gastos y la velocidad para conseguir inquilino. No siempre el barrio mas caro ofrece el mejor retorno.',
      },
      {
        heading: 'Ticket de entrada',
        body:
          'Barrios con precios de compra mas accesibles pueden mejorar el rendimiento relativo si sostienen buena demanda de alquiler.',
      },
      {
        heading: 'Demanda real',
        body:
          'La cercania a transporte, universidades, hospitales y corredores comerciales suele sostener ocupacion y reducir vacancia.',
      },
    ],
  },
  {
    id: 'rental-documents',
    slug: 'que-documentos-te-pueden-pedir-para-alquilar',
    title: 'Que documentos te pueden pedir para alquilar',
    excerpt: 'Una guia simple para preparar papeles antes de reservar.',
    category: 'ALQUILER',
    coverImage:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-05T12:00:00.000Z',
    readingMinutes: 3,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Quiero buscar alquileres y priorizar opciones con requisitos simples.',
    content: [
      {
        body:
          'Preparar documentacion antes de visitar ayuda a reservar mas rapido. Cada anunciante puede pedir requisitos distintos, pero hay patrones frecuentes.',
      },
      {
        heading: 'Ingresos y garantia',
        body:
          'Suelen solicitar comprobantes de ingresos, garantia propietaria, seguro de caucion o recibos de sueldo. Conviene preguntar antes de avanzar.',
      },
    ],
  },
  {
    id: 'first-home-guide',
    slug: 'guia-completa-para-comprar-tu-primera-propiedad',
    title: 'Guia completa para comprar tu primera propiedad',
    excerpt: 'Un recorrido practico para ordenar presupuesto, zona y decision.',
    category: 'COMPRA',
    coverImage:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-04-05T12:00:00.000Z',
    readingMinutes: 7,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Quiero comprar mi primera propiedad y necesito opciones segun mi presupuesto.',
    content: [
      {
        body:
          'Comprar por primera vez requiere separar deseo, presupuesto y riesgo. La busqueda mejora cuando definis condiciones no negociables y variables flexibles.',
      },
      {
        heading: 'Define presupuesto real',
        body:
          'Inclui gastos de escritura, mudanza, posibles arreglos y margen de negociacion. El precio publicado no es el unico numero relevante.',
      },
    ],
  },
  {
    id: 'home-wellbeing',
    slug: 'ergonomia-y-bienestar-en-tu-nuevo-hogar',
    title: 'Ergonomia y bienestar en tu nuevo hogar',
    excerpt: 'Como mirar luz, circulacion y espacios de trabajo antes de decidir.',
    category: 'TIPS',
    coverImage:
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
    publishedAt: '2026-03-28T12:00:00.000Z',
    readingMinutes: 4,
    author: 'busca.ar',
    status: 'PUBLISHED',
    relatedSearchPrompt: 'Busco propiedades luminosas y comodas para trabajar desde casa.',
    content: [
      {
        body:
          'La decision inmobiliaria no es solo precio y ubicacion. La luz, la ventilacion, el ruido y la posibilidad de armar un espacio de trabajo cambian la experiencia diaria.',
      },
      {
        heading: 'Luz y orientacion',
        body:
          'La orientacion y los edificios vecinos afectan luminosidad real. En visitas presenciales conviene mirar horarios y profundidad de ambientes.',
      },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class BlogDataService {
  private readonly api = inject(RealStateApiService);

  listArticlesFromApi(page = 1, limit = 20, category?: BlogCategory, query?: string) {
    return this.api.listBlogArticles(page, limit, category, query).pipe(
      map((response) => ({
        items: response.items.map((article) => this.toBlogArticle(article)),
        meta: response.meta,
      })),
    );
  }

  getArticleFromApi(slug: string) {
    return this.api.getBlogArticle(slug).pipe(map((article) => this.toBlogArticle(article)));
  }

  listArticles() {
    return BLOG_ARTICLES.filter((article) => article.status === 'PUBLISHED');
  }

  featuredArticles(limit = 3) {
    return this.listArticles().slice(0, limit);
  }

  findBySlug(slug: string) {
    return this.listArticles().find((article) => article.slug === slug) ?? null;
  }

  relatedArticles(article: BlogArticle, limit = 3) {
    return this.listArticles()
      .filter((candidate) => candidate.id !== article.id)
      .sort((left, right) => {
        if (left.category === article.category && right.category !== article.category) {
          return -1;
        }
        if (right.category === article.category && left.category !== article.category) {
          return 1;
        }
        return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
      })
      .slice(0, limit);
  }

  filterByCategory(category: BlogCategory | 'TODAS') {
    const articles = this.listArticles();
    return category === 'TODAS' ? articles : articles.filter((article) => article.category === category);
  }

  toBlogArticle(article: BlogArticleResponse): BlogArticle {
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      coverImage:
        article.coverImageUrl ||
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
      publishedAt: article.publishedAt ?? article.createdAt,
      readingMinutes: article.readingMinutes,
      author: article.author?.email ?? 'busca.ar',
      status: 'PUBLISHED',
      relatedSearchPrompt: article.relatedSearchPrompt ?? 'Quiero buscar propiedades relacionadas con este articulo.',
      content: article.content,
    };
  }
}
