import {
  SET_LOADING_STATUS,
  SET_LOADMORE,
  CLEAR_LOADMORE,
  SET_CAMPAIGNS,
  SET_LOADSTATUS,
  SET_FILTER,
  CLEAR_FILTER,
  SET_SEARCH
} from "./mutations.type";
import {
  LOAD_CAMPAIGNS,
  LOAD_MORE,
  RESET_LOAD,
  FILTER_CATEGORY,
  SEARCH_CAMPAIGN
} from "./actions.type";
import { firestore, storage } from "../firebase";

const state = {
  campaigns: [],
  loadMore: 2,
  loadSize: 2,
  completed: true,
  filter: {},
  search: null
};

const getters = {
  campaigns(state) {
    return state.campaigns;
  },
  loadMore(state) {
    return state.loadMore;
  },
  loadSize(state) {
    return state.loadSize;
  },
  completed(state) {
    return state.completed;
  }
};

const actions = {
  async [LOAD_CAMPAIGNS]({ commit, state }) {
    //If there is no filter associated
    if (Object.keys(state.filter).length === 0) {
      let firestore_query = null;
      //Search query

      if (!state.search) {
        firestore_query = firestore
          .collection("campaigns")
          .limit(state.loadSize);
        if (state.loadMore > state.loadSize) {
          //https://firebase.google.com/docs/firestore/query-data/query-cursors
          let lastElement = state.campaigns[state.campaigns.length - 1];
          firestore_query = firestore
            .collection("campaigns")
            .startAfter(lastElement)
            .limit(state.loadSize);
        } else {
          commit(SET_LOADING_STATUS, true);
        }
      } else {
        firestore_query = firestore.collection("campaigns");
        if (state.loadMore > state.loadSize) {
          let lastElement = state.campaigns[state.campaigns.length - 1];
          firestore_query = firestore
            .collection("campaigns")
            .startAfter(lastElement);
        }
        commit(SET_LOADING_STATUS, true);
      }

      try {
        let auxiliar_campaigns = [];

        await firestore_query.get().then(function(querySnapshot) {
          if (
            querySnapshot.docs.length % 2 != 0 ||
            querySnapshot.docs.length == 0
          ) {
            commit(SET_LOADSTATUS, true);
          } else {
            commit(SET_LOADSTATUS, false);
          }

          if (state.search != null) {
            querySnapshot.forEach(function(doc) {
              let title = doc
                .data()
                .title.toString()
                .toLowerCase();
              let query = state.search.toString();
              if (title.includes(query.toLowerCase())) {
                auxiliar_campaigns.push(doc);
              }
            });

            if (auxiliar_campaigns.length > state.loadSize) {
              commit(
                SET_CAMPAIGNS,
                auxiliar_campaigns.slice(0, state.loadSize)
              );
              auxiliar_campaigns = auxiliar_campaigns.slice(0, state.loadSize);
            } else {
              commit(SET_CAMPAIGNS, auxiliar_campaigns);
            }

            if (
              (state.loadMore > auxiliar_campaigns.length &&
                auxiliar_campaigns.length % 2 != 0) ||
              auxiliar_campaigns.length == 0
            ) {
              commit(SET_LOADSTATUS, true);
            } else {
              commit(SET_LOADSTATUS, false);
            }
          } else {
            auxiliar_campaigns = querySnapshot.docs;
            commit(SET_CAMPAIGNS, querySnapshot.docs);
          }

          commit(SET_LOADING_STATUS, false);

          auxiliar_campaigns.forEach(function(doc) {
            if (doc == null) return;
            storage
              .ref()
              .child("/campaigns/" + doc.id + "/img_pos0")
              .getMetadata()
              .then(function(metadata) {
                if (metadata.customMetadata.height < 370) {
                  document.getElementById(doc.id).style.objectFit = "contain";
                  //IE
                  document.getElementById(doc.id).style.fontFamily =
                    "object-fit: contain;";
                }
                //metadata.customMetadata.width
              })
              .catch(function(error) {
                console.log("Error retrieving campaigns: " + error);
              });

            storage
              .ref()
              .child("/campaigns/" + doc.id + "/img_pos0")
              .getDownloadURL()
              .then(function(url) {
                document.getElementById(doc.id).src = url;
              })
              .catch(function(error) {
                console.error(error);
              });
          });
        });
      } catch (error) {
        console.log("Error: " + error);
      }
    } else {
      let campaignRef = null;
      if (state.loadMore > state.loadSize) {
        //https://firebase.google.com/docs/firestore/query-data/query-cursors
        let lastElement = state.campaigns[state.campaigns.length - 1];

        if (state.filter.type == "ALL") {
          campaignRef = firestore
            .collection("campaigns")
            .startAfter(lastElement)
            .limit(state.loadSize);
        } else {
          campaignRef = firestore
            .collection("campaigns")
            .startAfter(lastElement)
            .limit(state.loadSize)
            .where("category", "==", state.filter.type);
        }
      } else {
        commit(SET_LOADING_STATUS, true);

        if (state.filter.type == "ALL") {
          campaignRef = firestore.collection("campaigns").limit(state.loadSize);
        } else {
          campaignRef = firestore
            .collection("campaigns")
            .where("category", "==", state.filter.type)
            .limit(state.loadSize);
        }
      }

      campaignRef.get().then(function(querySnapshot) {
        let auxiliar_campaigns = [];
        if (querySnapshot.docs.length == 0) {
          commit(SET_LOADSTATUS, true);
        } else {
          commit(SET_LOADSTATUS, false);
        }
        querySnapshot.forEach(function(doc) {
          //doc.data() is never undefined for query doc snapshots
          let days = calculateDays(
            doc.data().creationDate,
            doc.data().duration
          );
          switch (state.filter.status) {
            case "0":
              if (days.indexOf("Ended") == -1) {
                auxiliar_campaigns.push(doc);
              }
              break;
            case "1":
              if (days.indexOf("Ended") != -1) {
                auxiliar_campaigns.push(doc);
              }
              break;
            case "2":
              auxiliar_campaigns.push(doc);
              break;
          }
        });

        if (
          auxiliar_campaigns.length % 2 != 0 ||
          auxiliar_campaigns.length == 0
        ) {
          commit(SET_LOADSTATUS, true);
        } else {
          commit(SET_LOADSTATUS, false);
        }

        commit(SET_CAMPAIGNS, auxiliar_campaigns);
        commit(SET_LOADING_STATUS, false);

        auxiliar_campaigns.forEach(function(doc) {
          storage
            .ref()
            .child("/campaigns/" + doc.id + "/img_pos0")
            .getMetadata()
            .then(function(metadata) {
              if (metadata.customMetadata.height < 370) {
                document.getElementById(doc.id).style.objectFit = "contain";
                //IE
                document.getElementById(doc.id).style.fontFamily =
                  "object-fit: contain;";
              }
            })
            .catch(function(error) {
              console.log("Erro: " + error);
            });

          storage
            .ref()
            .child("/campaigns/" + doc.id + "/img_pos0")
            .getDownloadURL()
            .then(function(url) {
              document.getElementById(doc.id).src = url;
            })
            .catch(function(error) {
              console.error(error);
            });
        });
      });
    }
  },
  async [LOAD_MORE]({ commit, dispatch }) {
    commit(SET_LOADMORE);
    dispatch(LOAD_CAMPAIGNS);
  },
  async [RESET_LOAD]({ commit }) {
    commit(CLEAR_LOADMORE);
  },
  async [FILTER_CATEGORY]({ commit, dispatch }, data) {
    commit(CLEAR_LOADMORE);
    commit(SET_FILTER, data);
    dispatch(LOAD_CAMPAIGNS);
  },
  async [SEARCH_CAMPAIGN]({ commit, dispatch }, query) {
    commit(CLEAR_LOADMORE);
    commit(SET_SEARCH, query);
    dispatch(LOAD_CAMPAIGNS);
  }
};

const mutations = {
  [SET_LOADMORE](state) {
    state.loadMore += state.loadSize;
  },
  [CLEAR_LOADMORE](state) {
    state.loadMore = state.loadSize;
  },
  [SET_CAMPAIGNS](state, data) {
    if (data.length === 0) return;

    if (state.loadMore > 2) {
      state.campaigns = state.campaigns.concat(data);
    } else {
      state.campaigns = data;
    }
  },
  [CLEAR_LOADMORE](state) {
    state.loadMore = state.loadSize;
    state.completed = true;
    state.campaigns = [];
    state.filter = {};
    state.search = null;
  },
  [SET_LOADSTATUS](state, data) {
    state.completed = data;
  },
  [SET_FILTER](state, data) {
    state.filter = data;
  },
  [CLEAR_FILTER](state) {
    state.filter = {};
  },
  [SET_SEARCH](state, text) {
    state.search = text;
  }
};

function calculateDays(date, duration) {
  let auxDate = new Date(date);
  let date1 = new Date();
  let days = parseInt(duration);
  auxDate.setDate(auxDate.getDate() + days);
  if (date1 > auxDate) {
    return "Ended";
  }

  let timeDiff = Math.abs(auxDate.getTime() - date1.getTime());
  let diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (diffDays == 1) {
    return diffDays + " day left";
  }
  return diffDays + " days left";
}

export default {
  state,
  actions,
  mutations,
  getters
};
