import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/observable/combineLatest';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

import { Article } from './article';
import { environment } from '../environments/environment';

/*
 * [].sort(compare(a, b))
 * return value
 * 0 == they are equal in sort
 * 1 == a comes before b
 * -1 == b comes before a
 */
interface ArticleSortFn {
  (a : Article, b : Article): number;
}

interface ArticleSortOrderFn {
  (direction : number): ArticleSortFn;
}

const sortByTime: ArticleSortOrderFn = (direction : number) => (a : Article, b : Article) => {
    return direction * (b.publishedAt.getTime() - a.publishedAt.getTime());
};

const sortByVotes: ArticleSortOrderFn = (direction : number) => (a : Article, b : Article) => {
  return direction * (b.votes - a.votes);
};

const sortFns = {
    'Time': sortByTime,
    'Votes': sortByVotes
};

@Injectable()

export class ArticleService {
    private _articles : BehaviorSubject<Article[]> = new BehaviorSubject<Article[]>([]);
    private _sources : BehaviorSubject<any> = new BehaviorSubject<any>([]);

    private _refreshSubject : BehaviorSubject<string> = new BehaviorSubject<string>('reddit-r-all');
    private _sortByDirectionSubject : BehaviorSubject<number> = new BehaviorSubject<number>(1);
    private _sortByFilterSubject : BehaviorSubject<ArticleSortOrderFn> = new BehaviorSubject<ArticleSortOrderFn>(sortByTime);
    private _filterBySubject : BehaviorSubject<string> = new BehaviorSubject<string>('');

    public sources : Observable<any> = this._sources.asObservable();
    public articles : Observable<Article[]> = this._articles.asObservable();
    public orderedArticles : Observable<Article[]>;

    constructor(
        protected httpClient : HttpClient,
    ) {
        this._refreshSubject
            .subscribe(this.getArticles.bind(this));
        this.orderedArticles = Observable.combineLatest(
                this._articles,
                this._sortByFilterSubject,
                this._sortByDirectionSubject,
                this._filterBySubject
            )
            .map(([articles, sorter, direction, filterStr]) => {
                const re = new RegExp(filterStr, 'gi');
                return articles
                    .filter(a => re.exec(a.title))
                    .sort(sorter(direction));
            });
    }

    public sortBy(
        filter : string,
        direction : number
    ): void {
        this._sortByDirectionSubject.next(direction);
        this._sortByFilterSubject.next(sortFns[filter]);
    }

    public filterBy(filter : string) {
        this._filterBySubject.next(filter);
    }

    public updateArticles(sourceKey): void {
        this._refreshSubject.next(sourceKey);
    }

    public getArticles(sourceKey = 'reddit-r-all'): void {
        // make the http request -> Observable
        // convert response json objects into article class
        // update our subject, consumer will subscribe to attribute on article service

        this._makeHttpRequest('/v2/top-headlines', sourceKey)
            .subscribe(articlesJSON => {
                const articles = articlesJSON.articles
                    .map(articlejson => Article.fromJSON(articlejson));
                    this._articles.next(articles);
            });
    }

    public getSources(): void {
        this._makeHttpRequest('/v2/sources')
          .subscribe(sourcesJSON => {
            const sources = sourcesJSON.sources;
            this._sources.next(sources);
          });
            // .subscribe(this._sources);
    }

    private _makeHttpRequest(
        path : string,
        sourceKey? : string
    ): Observable<any> {
        const params = {
            apiKey : environment.newsApiKey,
            sources : ''
        };

        if (sourceKey && sourceKey !== '') {
            params.sources = sourceKey;
        }

        return this.httpClient
            .get<any>(`${ environment.baseUrl }${ path }`, { params : params } )
            .map(res => res);
    }
}
