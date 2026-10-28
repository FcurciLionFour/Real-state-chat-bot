import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../services/auth.store';
import { API_BASE_URL } from '../services/real-state-api.service';

function withApiCredentials(request: HttpRequest<unknown>, accessToken: string | null) {
  if (!accessToken) {
    return request.clone({
      withCredentials: true,
    });
  }

  return request.clone({
    withCredentials: true,
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export const authInterceptor: HttpInterceptorFn = (request, next: HttpHandlerFn) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const isApiRequest = request.url.startsWith(API_BASE_URL);
  const preparedRequest = isApiRequest ? withApiCredentials(request, authStore.accessToken()) : request;

  return next(preparedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !isApiRequest) {
        return throwError(() => error);
      }

      if (request.url.endsWith('/auth/login') || request.url.endsWith('/auth/register') || request.url.endsWith('/auth/refresh')) {
        return throwError(() => error);
      }

      return from(authStore.refreshAccessToken()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            void router.navigate(['/login'], {
              queryParams: {
                redirectTo: router.url,
              },
            });
            return throwError(() => error);
          }

          return next(withApiCredentials(request, authStore.accessToken()));
        }),
        catchError((refreshError: unknown) => {
          void router.navigate(['/login'], {
            queryParams: {
              redirectTo: router.url,
            },
          });
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
