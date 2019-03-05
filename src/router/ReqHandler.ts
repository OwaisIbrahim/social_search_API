import {Router, Request, Response, NextFunction} from "express";
import SMP from "../controllers/SMP";
import * as request from 'request'
import SMPfactory from "../controllers/SMPFactory";
import {Promise} from "es6-promise";

import * as uni from "array-unique";
import {log} from "util";


const unique = uni.immutable;

enum query {
  flickr = "text",
  twitter = "q",
  youtube = "q",
  dailymotion = "query",
  vimeo = "query",
  tumblr = "query",
  googleplus = "query",
}
enum maxResults {
  youtube = "maxResults",
  twitter = "count",
  flickr = "per_page",
  dailymotion = "limit",
  vimeo = "per_page",
  tumblr = "limit",
  googleplus = "maxResults",
}

enum relevance {
  youtube = "relevance",
  googleplus = "best",
  twitter = "mixed",
  vimeo = "relevant",
  dailymotion = "relevance",
  flickr = "relevance",
  tumblr = "",
}

enum rating {
  youtube = "rating",
  googleplus = "best",
  twitter = "popular",
  vimeo = "likes",
  dailymotion = "trending",
  flickr = "interestingness-asc",
  tumblr = "",
}

enum recency {
  youtube = "date",
  googleplus = "recent",
  twitter = "recent",
  vimeo = "date",
  dailymotion = "recent",
  flickr = "date-posted-desc",
  tumblr = "",
}

enum title {
  youtube = "title",
  googleplus = "best",
  twitter = "mixed",
  vimeo = "alphabetical",
  dailymotion = "relevance",
  flickr = "relevance",
  tumblr = "",
}

enum views {
  youtube = "viewCount",
  googleplus = "best",
  twitter = "popular",
  vimeo = "plays",
  dailymotion = "trending",
  flickr = "interestingness-asc",
  tumblr = "",
}

export class RequestHandler {
  private smp: SMP;
  constructor() {}

  // the /seearch will redirect to this page and only this method will handle the request
  public handleAllRequest = (req: Request, res: Response) => {
    // Array of results
    // let result: JSON[] = new Array();
    let smpCreator = new SMPfactory();
    let numSocialMediaAccounts: number = 9;
    let myPromises = new Array(numSocialMediaAccounts);
    let myeditList = [];
    console.log(req.body);
    // Cycle through all the user requested smps
    for (var _i = 0; _i < req.body.smpList.length; _i++) {
      // Generate smp
      this.smp = smpCreator.generate(req.body.smpList[_i].name);
      if (this.smp) {
        // Call that smps search and initialize the result var with its result
        //    result.push(null);  // Increase length of result array

        myPromises[_i] = new Promise((resolve, reject) => {
          this.smp.searchByKeyword(
            req.body.smpList[_i].params,
            resolve,
            reject,
          );
        });
        myeditList.push(myPromises[_i]);
      }
    }

    Promise.all(myeditList)
      .then(values => {
        res.send(values);
      })
      .catch(err => {
        console.log("Reject_Error: " + err);
        res.send(err);
      });
  };

  public handleSocialSearchRequest = (req: Request, res: Response) => {
    // Array of results
    // let result: JSON[] = new Array();

    let smpCreator = new SMPfactory();
    let numSocialMediaAccounts: number = 9;
    let myPromises = new Array(numSocialMediaAccounts);
    let myeditList = [];
    // Cycle through all the user requested smps
    for (var _i = 0; _i < req.body.smpList.length; _i++) {
      // Generate smp
      this.smp = smpCreator.generate(req.body.smpList[_i]);
      if (this.smp) {
        // Call that smps search and initialize the result var with its result
        //    result.push(null);  // Increase length of result array
        let myParams = {};
        myPromises[_i] = new Promise((resolve, reject) => {
          myParams = this.resolveEnum(
            req.body.smpList[_i],
            req.body.params,
            res,
          );
          this.smp.searchByKeyword(myParams, resolve, reject);
        });
        myeditList.push(myPromises[_i]);
      }
    }

    Promise.all(myeditList)
      .then(values => {
        res.send(
          this.mapResult(
            req.body.smpList,
            values,
            req.body.params.query,
            req.body.params.maxResults,
          ),
        );
        //        res.send(values);
      })
      .catch(err => {
        console.log("Reject_Error: " + err);
        res.send(err);
      });
  };

  public handleWikipedia = (req : Request , res :Response) => {
  
    var Search = req.body.query;
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/'+Search;

            request(url, function (error, response, body) {
          if (!error && response.statusCode == 200) {
               var obj = JSON.parse(body)
               
               res.send(obj.extract)
             
           }
           else 
           {
               console.log("error")
               res.send("error");
           }
      })

     
      



  };
 

  public resolveEnum(str: string, myParams, res): {} {
    let params = {};
    if (
      myParams.query !== "undefined" ||
      myParams.query != null ||
      myParams.query !== ""
    ) {
      params[query[str]] = myParams.query;
    } else {
      res.status(403).send("Invalid parameters");
      res.end();
    }

    if (
      myParams.maxResults === "undefined" ||
      myParams.maxResults == null ||
      myParams.maxResults === 0
    ) {
      myParams.maxResults = 5;
    }
    params[maxResults[str]] = myParams.maxResults;

    params.sort = this.sortType(myParams.sort, str);

    return params;
  }

  public sortType(str: string, platform: string) {
    if (str) {
      if (str === "rating") {
        return rating[platform];
      } else if (str === "recency") {
        return recency[platform];
      } else if (str === "title") {
        return title[platform];
      } else if (str === "views") {
        return views[platform];
      } else {
        return relevance[platform];
      }
    } else {
      return relevance[platform];
    }
  }

  /**
   *
   * @param smpList
   * @param data
   * @param q
   * @param resultCount
   * @description function to map result data to a simpler format
   */
  public mapResult(
    smpList: string[],
    data: JSON,
    q: string,
    resultCount: number,
  ): JSON {
    let result: JSON = {};
    let platform: SMP;
    let factory: SMPfactory = new SMPfactory();

    result.query = q;
    result.resultList = new Array(smpList.length);

    let i = 0; // to traverse each smp
    for (let smp of smpList) {
      // Create results array
      result.resultList[i] = {};
      // Create results array
      result.resultList[i].name = smp;
      result.resultList[i].results = new Array(resultCount);

      // create smp
      platform = factory.generate(smp);

      // Query each smps noramlizer and initialize its result
      result.resultList[i].results = platform.normalizeResult(data[i]);

      i++;
    }
    return result;
  }
}
