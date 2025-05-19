<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:param name="categoryFilter" select="'All'"/>
  <xsl:param name="secondaryCategoryFilter" select="'All'"/>

  <xsl:template match="/">
    <div class="transactions-table">
      <h4>Showing <xsl:value-of select="$categoryFilter"/> transactions</h4>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Category</th>
            <th>Rating</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <xsl:choose>
            <xsl:when test="financialData/transactions/transaction">
              <xsl:apply-templates select="financialData/transactions/transaction">
                <xsl:sort select="date" order="descending"/>
              </xsl:apply-templates>
            </xsl:when>
            <xsl:otherwise>
              <tr>
                <td colspan="8">No transactions available.</td>
              </tr>
            </xsl:otherwise>
          </xsl:choose>
        </tbody>
      </table>
    </div>
  </xsl:template>

  <xsl:template match="transaction">
    <xsl:if test="($categoryFilter = 'All' or type = $categoryFilter) and 
                  ($secondaryCategoryFilter = 'All' or category = $secondaryCategoryFilter or (category = '' and $secondaryCategoryFilter = 'None'))">
      <tr>
        <td><xsl:value-of select="@id"/></td>
        <td><xsl:value-of select="date"/></td>
        <td><xsl:value-of select="description"/></td>
        <td>
          <xsl:choose>
            <xsl:when test="type = 'Income'">
              <span class="positive"><xsl:value-of select="format-number(amount, '#,##0.00')"/></span>
            </xsl:when>
            <xsl:otherwise>
              <span class="negative"><xsl:value-of select="format-number(amount, '#,##0.00')"/></span>
            </xsl:otherwise>
          </xsl:choose>
        </td>
        <td><xsl:value-of select="type"/></td>
        <td><xsl:value-of select="category"/></td>
        <td><xsl:value-of select="rating"/></td>
        <td>
          <button class="btn edit-btn" data-id="{@id}" data-type="transaction">Edit</button>
          <button class="btn delete-btn" data-id="{@id}" data-type="transaction">Delete</button>
        </td>
      </tr>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>