describe('chowdown homepage', () => {
  it('should load the homepage with a 200', () => {
    cy.request('http://localhost:3737/').then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
