const GRAPHQL_ENDPOINT = 'https://api.v2.bit.cloud/graphql';

export const scopeQuery = (id: string, token: string) => {
  const query = `
    query GET_SCOPE($scopeId: String!) {
      getScope(id: $scopeId) {
        id
      }
    }
  `;

  const variables = { scopeId: id };

  return fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  }).then(response => response.json());
};