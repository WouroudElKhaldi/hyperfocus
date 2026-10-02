import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Books, one book, and its AI chat through the shared cache (P3-10). A change on the book page (status, notes, a new
// search) is written into both the book and the list, so going back to Books shows it at once.

type BookList = ResponseOf<"get", "/books">;
type Book = ResponseOf<"get", `/books/${number}`>;
type Chat = ResponseOf<"get", `/books/${number}/chat`>;
const BOOKS = keyOf("/books");

export const useBooks = () => useApi("/books");

/** One book. Its page shows a missing book or a failed load itself, so no error toast. */
export const useBook = (id: number) => useApi(`/books/${id}`, { enabled: Number.isInteger(id), meta: { silent: true } });

function useBookCache() {
  const client = useQueryClient();
  return {
    client,
    /** Puts the book the server sent back into the list and into its own entry (a new one goes first). */
    write: (b: Book) => {
      client.setQueryData<Book>(keyOf(`/books/${b.id}`), b);
      client.setQueryData<BookList>(BOOKS, (list) => list && (list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? b : x)) : [b, ...list]));
    },
    refresh: () => client.invalidateQueries({ queryKey: BOOKS }),
  };
}

export function useAddBook() {
  const { write, refresh } = useBookCache();
  return useMutation({ mutationFn: (book: BodyOf<"post", "/books">) => api.post("/books", book), onSuccess: write, onSettled: refresh });
}

export function useDeleteBook() {
  const { client, refresh } = useBookCache();
  return useMutation({
    mutationFn: (id: number) => api.del(`/books/${id}`),
    onMutate: (id) => optimistic<BookList>(client, BOOKS, (list = []) => list.filter((b) => b.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: refresh,
  });
}

/** Changes one book: its fields (status, title, notes …), or a new search for copies. */
export function useBookChanges(id: number) {
  const { write, refresh } = useBookCache();
  return {
    update: useMutation({ mutationFn: (change: BodyOf<"patch", `/books/${number}`>) => api.patch(`/books/${id}`, change), onSuccess: write, onSettled: refresh }),
    find: useMutation({ mutationFn: () => api.post(`/books/${id}/find`), onSuccess: write, onSettled: refresh }),
  };
}

/** The saved questions and answers about a book. */
export const useBookChat = (id: number) => useApi(`/books/${id}/chat`);

/** Asks the AI about a book: the question shows at once, and comes back to the box if the AI fails. */
export function useAskBook(id: number) {
  const client = useQueryClient();
  const key = keyOf(`/books/${id}/chat`);
  return useMutation({
    mutationFn: (question: string) => api.post(`/books/${id}/ask`, { question }),
    onMutate: (question) =>
      optimistic<Chat>(client, key, (chat = []) => [...chat, { id: -Date.now(), bookId: id, role: "user", content: question, createdAt: new Date().toISOString() }]),
    onSuccess: (out) => client.setQueryData<Chat>(key, (chat = []) => [...chat.filter((m) => m.id > 0), out.user, out.assistant]),
    onError: (_error, _question, undo) => undo?.(),
  });
}

export function useClearBookChat(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.del(`/books/${id}/chat`),
    onSuccess: () => client.setQueryData<Chat>(keyOf(`/books/${id}/chat`), []),
  });
}
